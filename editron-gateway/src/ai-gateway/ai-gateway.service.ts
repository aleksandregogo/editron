import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom, catchError, map, Observable, switchMap } from 'rxjs';
import { AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios';
import { Readable } from 'stream';

export enum LLMTargetEnum {
    GATEWAY_WORKERSAI = 'workers-ai',
    GATEWAY_OPENAI = 'openai',
}

export enum ChatMessageRole {
    SYSTEM = 'system',
    USER = 'user',
    ASSISTANT = 'assistant',
}

export interface ChatMessage {
    role: ChatMessageRole;
    content: string;
}

@Injectable()
export class AiGatewayService {
    private readonly logger = new Logger(AiGatewayService.name);
    private readonly gatewayApiUrl: string;
    private readonly cfGatewayToken: string;
    private readonly cfWorkerToken: string;
    private readonly embeddingModelId: string;
    private readonly chatModelId: string;

    constructor(
        private readonly configService: ConfigService,
        private readonly httpService: HttpService,
    ) {
        const accountId = this.configService.getOrThrow<string>('CLOUDFLARE_ACCOUNT_ID');
        this.cfGatewayToken = this.configService.getOrThrow<string>('CLOUDFLARE_GATEWAY_TOKEN');
        this.cfWorkerToken = this.configService.getOrThrow<string>('CLOUDFLARE_WORKER_TOKEN');

        const gatewaySlug = this.configService.get<string>('CLOUDFLARE_GATEWAY_SLUG', 'editron-ai');
        this.gatewayApiUrl = `https://gateway.ai.cloudflare.com/v1/${accountId}/${gatewaySlug}`;

        this.embeddingModelId = this.configService.getOrThrow<string>('CLOUDFLARE_EMBEDDING_MODEL_ID');
        this.chatModelId = this.configService.getOrThrow<string>('CLOUDFLARE_LLM_MODEL_ID');
    }

    async generateEmbeddings(texts: string[], batchSize = 50): Promise<number[][]> {
        const allEmbeddings: number[][] = [];

        for (let i = 0; i < texts.length; i += batchSize) {
            const batch = texts.slice(i, i + batchSize);
            const input = { text: batch };

            const response = await this.makeRequest<{ data: number[][] }>(
                LLMTargetEnum.GATEWAY_WORKERSAI,
                this.embeddingModelId,
                input
            );

            if (response?.data) {
                allEmbeddings.push(...response.data);
            } else {
                this.logger.error("Failed to process embedding response from Workers AI");
                throw new Error('Embedding generation failed');
            }
        }
        return allEmbeddings;
    }

    async callChatCompletionsStream(messages: ChatMessage[]): Promise<Observable<string>> {
        const finalPathOrId = `workers-ai/${this.chatModelId}`;
        const url = `${this.gatewayApiUrl}/${finalPathOrId}`;

        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'text/event-stream',
            'cf-aig-authorization': `Bearer ${this.cfGatewayToken}`,
            'Authorization': `Bearer ${this.cfWorkerToken}`,
        };

        const input = {
            messages: messages.map(m => ({ role: m.role, content: m.content })),
            stream: true,
            max_tokens: 1024,
            temperature: 0.7,
        };

        this.logger.debug(`Initiating STREAMING Workers AI request to ${url}`);

        return this.httpService.post(url, input, {
            headers,
            responseType: 'stream',
        }).pipe(
            map((response: AxiosResponse<Readable>) => response.data),
            switchMap(stream => {
                return new Observable<string>(subscriber => {
                    const decoder = new TextDecoder();
                    let buffer = ''; // Buffer for partial data

                    stream.on('data', (chunk: Buffer) => {
                        try {
                            // Append new chunk to buffer
                            buffer += chunk.toString('utf-8');
                            
                            // Process complete lines from buffer
                            const lines = buffer.split('\n');
                            // Keep the last incomplete line in buffer
                            buffer = lines.pop() || '';

                            for (const line of lines) {
                                if (line.trim() && line.startsWith('data: ')) {
                                    const eventData = line.substring(6).trim();
                                    
                                    if (eventData === '[DONE]') {
                                        this.logger.log('Received [DONE] signal.');
                                        if (!subscriber.closed) subscriber.complete();
                                        return;
                                    }

                                    try {
                                        const parsedJson = JSON.parse(eventData);
                                        
                                        // Handle Workers AI response format
                                        if (parsedJson && typeof parsedJson.response === 'string') {
                                            if (parsedJson.response.length > 0) {
                                                subscriber.next(parsedJson.response);
                                            }
                                        }
                                        // Handle OpenAI format (fallback)
                                        else if (parsedJson?.choices?.[0]?.delta?.content) {
                                            subscriber.next(parsedJson.choices[0].delta.content);
                                        }
                                    } catch (jsonError) {
                                        // Ignore parse errors for partial chunks
                                    }
                                }
                            }
                        } catch (e) {
                            this.logger.error('Error processing raw stream chunk buffer', e);
                            if (!subscriber.closed) subscriber.error(e);
                        }
                    });

                    stream.on('error', (err) => {
                        this.logger.error(`Stream error:`, err);
                        if (!subscriber.closed) subscriber.error(err);
                    });

                    stream.on('end', () => {
                        this.logger.log(`Stream ended event received`);
                        
                        // Process any remaining buffer content
                        if (buffer.trim() && buffer.startsWith('data: ')) {
                            const eventData = buffer.substring(6).trim();
                            if (eventData && eventData !== '[DONE]') {
                                try {
                                    const parsedJson = JSON.parse(eventData);
                                    if (parsedJson && typeof parsedJson.response === 'string' && parsedJson.response.length > 0) {
                                        subscriber.next(parsedJson.response);
                                    }
                                } catch (jsonError) {
                                    // Ignore parse errors for final chunk
                                }
                            }
                        }
                        
                        if (!subscriber.closed) subscriber.complete();
                    });

                    return () => {
                        this.logger.log(`Unsubscribing from stream. Destroying.`);
                        if (!stream.destroyed) {
                            stream.destroy();
                        }
                    };
                });
            }),
            catchError((error: AxiosError) => {
                this.logger.error(`Workers AI Streaming Request Error: ${error.message}`, error.stack);
                if (error.response) {
                    this.logger.error(`Error Response Status: ${error.response.status}`);
                    this.logger.error(`Error Response Data: ${JSON.stringify(error.response.data)}`);
                }
                throw error;
            }),
        );
    }

    private async makeRequest<T = any>(
        target: LLMTargetEnum,
        modelId: string,
        input: any,
        requestConfigOverrides: AxiosRequestConfig = {}
    ): Promise<T | null> {
        let finalPathOrId = modelId;
        const headers = {
            'Content-Type': 'application/json',
            'cf-aig-authorization': `Bearer ${this.cfGatewayToken}`,
            ...(requestConfigOverrides.headers || {}),
        };

        if (target === LLMTargetEnum.GATEWAY_WORKERSAI) {
            finalPathOrId = `workers-ai/${modelId}`;
            headers['Authorization'] = `Bearer ${this.cfWorkerToken}`;
        }

        const url = `${this.gatewayApiUrl}/${finalPathOrId}`;

        const requestConfig: AxiosRequestConfig = {
            headers,
            responseType: 'json',
            ...requestConfigOverrides
        };

        this.logger.debug(`Making AI ${target} request to ${url}`);

        try {
            const response = await firstValueFrom(
                this.httpService.post(url, input, requestConfig).pipe(
                    catchError((error: AxiosError) => {
                        this.logger.error(`AI Request Error for target ${target}, model ${modelId}: ${error.message}`, error.stack);
                        if (error.response) {
                            this.logger.error(`Error Response Status: ${error.response.status}`);
                            this.logger.error(`Error Response Data: ${JSON.stringify(error.response.data)}`);
                        }
                        throw error;
                    }),
                )
            );

            if (target === LLMTargetEnum.GATEWAY_WORKERSAI) {
                this.logger.debug(`Workers AI response received for ${modelId}`);
                return response.data?.result as T ?? response.data as T;
            }

            return response.data as T;
        } catch (error) {
            this.logger.error(`Failed to complete AI request for target ${target}, model ${modelId}`, error.message);
            return null;
        }
    }
} 