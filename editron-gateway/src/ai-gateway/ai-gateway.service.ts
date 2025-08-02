import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom, catchError, map, Observable, switchMap, retry, throwError } from 'rxjs';
import { AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios';
import { Readable } from 'stream';

// Define the available providers through the gateway
export enum AiProvider {
  WORKERS_AI = 'workers-ai',
  OPENAI = 'openai',
}

// Define the specific models we will support
export enum ChatModel {
  LLAMA_3 = 'llama-3',
  GPT4_MINI = 'gpt-4-mini',
} 

// Map our abstract models to their provider and actual model ID
const modelProviderMap = {
  [ChatModel.LLAMA_3]: {
    provider: AiProvider.WORKERS_AI,
    id: '@cf/meta/llama-3-8b-instruct', // From your .env
  },
  [ChatModel.GPT4_MINI]: {
    provider: AiProvider.OPENAI,
    id: 'gpt-4.1-mini-2025-04-14', // From your .env
  },
};

// Model-specific token limits
const getModelTokenLimits = (model: ChatModel) => {
  switch (model) {
    case ChatModel.GPT4_MINI:
      return {
        maxContextTokens: 1000000, // GPT-4.1-mini has ~1M context window
        maxOutputTokens: 32768, // GPT-4.1-mini max output tokens
        reservedForOutput: 5000
      };
    case ChatModel.LLAMA_3:
      return {
        maxContextTokens: 8000, // Llama-3-8b context limit
        maxOutputTokens: 4096,
        reservedForOutput: 1500
      };
    default:
      return {
        maxContextTokens: 6000,
        maxOutputTokens: 4096,
        reservedForOutput: 1500
      };
  }
};

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
  private readonly openAIApiKey: string;
  private readonly embeddingModelId: string;
  private readonly maxRetries = 1;
  private readonly requestTimeout = 60000; // Increased to 60 seconds for larger models

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    const accountId = this.configService.getOrThrow<string>('CLOUDFLARE_ACCOUNT_ID');
    const gatewaySlug = this.configService.get<string>('CLOUDFLARE_GATEWAY_SLUG', 'editron-ai');
    this.gatewayApiUrl = `https://gateway.ai.cloudflare.com/v1/${accountId}/${gatewaySlug}`;

    // Provider-specific credentials
    this.cfGatewayToken = this.configService.getOrThrow<string>('CLOUDFLARE_GATEWAY_TOKEN');
    this.cfWorkerToken = this.configService.getOrThrow<string>('CLOUDFLARE_WORKER_TOKEN');
    this.openAIApiKey = this.configService.getOrThrow<string>('OPENAI_API_KEY');

    // Embedding model remains tied to Workers AI for now
    this.embeddingModelId = this.configService.getOrThrow<string>('CLOUDFLARE_EMBEDDING_MODEL_ID');
    
    // Update model IDs from config
    modelProviderMap[ChatModel.LLAMA_3].id = this.configService.getOrThrow<string>('CLOUDFLARE_LLM_MODEL_ID');
    modelProviderMap[ChatModel.GPT4_MINI].id = this.configService.getOrThrow<string>('OPENAI_CHAT_MODEL_ID');
    
    // Debug logging
    this.logger.log(`Model configuration:`, {
      llama3: modelProviderMap[ChatModel.LLAMA_3].id,
      gpt4Turbo: modelProviderMap[ChatModel.GPT4_MINI].id,
    });
  }

  // This private method is now the single point of contact with the gateway
  private makeRequest<T>(
    provider: AiProvider,
    path: string, // e.g., 'chat/completions' or '@cf/meta/llama-3...'
    payload: unknown,
    config: AxiosRequestConfig = {},
  ): Observable<AxiosResponse<T>> {
    let url: string;
    
    // OpenAI uses a different URL structure
    if (provider === AiProvider.OPENAI) {
      url = `${this.gatewayApiUrl}/${provider}/${path}`;
    } else {
      url = `${this.gatewayApiUrl}/${provider}/${path}`;
    }
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'cf-aig-authorization': `Bearer ${this.cfGatewayToken}`, // Gateway token is always present
      ...(config.headers as Record<string, string> || {}),
    };

    // Add provider-specific authentication
    if (provider === AiProvider.OPENAI) {
      headers['Authorization'] = `Bearer ${this.openAIApiKey}`;
    } else if (provider === AiProvider.WORKERS_AI) {
      headers['Authorization'] = `Bearer ${this.cfWorkerToken}`;
    }

    this.logger.debug(`Making AI Gateway request to provider '${provider}' at URL: ${url}`);
    this.logger.debug(`Request payload:`, JSON.stringify(payload, null, 2));

    return this.httpService.post<T>(url, payload, { ...config, headers, timeout: this.requestTimeout }).pipe(
      retry(this.maxRetries),
      catchError((error: AxiosError) => {
        this.logger.error(`AI Gateway Request Error for provider ${provider}, path ${path}: ${error.message}`, error.stack);
        if (error.response) {
          this.logger.error(`Error Response Status: ${error.response.status}`);
          this.logger.error(`Error Response Data: ${JSON.stringify(error.response.data)}`);
        }
        return throwError(() => new Error(`AI service unavailable: ${error.message}`));
      }),
    );
  }

  // Public method for non-streaming chat
  async callChatCompletions(
    messages: ChatMessage[],
    model: ChatModel = ChatModel.GPT4_MINI, // Default to GPT-4 Turbo
  ): Promise<string> {
    const modelInfo = modelProviderMap[model];
    if (!modelInfo) {
      throw new BadRequestException(`Unsupported chat model: ${model}`);
    }

    const tokenLimits = getModelTokenLimits(model);
    let payload: any;
    let requestPath: string;

    if (modelInfo.provider === AiProvider.OPENAI) {
      // OpenAI format: model goes in payload
      payload = {
        model: modelInfo.id,
        messages,
        stream: false,
        max_tokens: tokenLimits.maxOutputTokens,
      };
      requestPath = 'chat/completions'; // OpenAI path
    } else {
      // Workers AI format: model goes in path
      payload = {
        messages,
        stream: false,
        max_tokens: tokenLimits.maxOutputTokens,
      };
      requestPath = modelInfo.id;
    }

    const response$ = this.makeRequest(modelInfo.provider, requestPath, payload);
    const response = await firstValueFrom(response$);

    // Handle different response structures from different providers
    if (modelInfo.provider === AiProvider.OPENAI) {
      return (response.data as any)?.choices?.[0]?.message?.content ?? '';
    } else if (modelInfo.provider === AiProvider.WORKERS_AI) {
      return (response.data as any)?.result?.response ?? '';
    }

    throw new Error('Unknown response format from AI provider.');
  }

  // Public method for streaming chat
  callChatCompletionsStream(
    messages: ChatMessage[],
    model: ChatModel = ChatModel.GPT4_MINI, // Default to GPT-4 Turbo
  ): Observable<string> {
    const modelInfo = modelProviderMap[model];
    if (!modelInfo) {
      throw new BadRequestException(`Unsupported chat model: ${model}`);
    }

    const tokenLimits = getModelTokenLimits(model);
    let payload: any;
    let requestPath: string;

    if (modelInfo.provider === AiProvider.OPENAI) {
      // OpenAI format: model goes in payload
      payload = {
        model: modelInfo.id,
        messages,
        stream: true,
        max_tokens: tokenLimits.maxOutputTokens,
      };
      requestPath = 'chat/completions'; // OpenAI path
    } else {
      // Workers AI format: model goes in path
      payload = {
        messages,
        stream: true,
        max_tokens: tokenLimits.maxOutputTokens,
      };
      requestPath = modelInfo.id;
    }

    const response$ = this.makeRequest(modelInfo.provider, requestPath, payload, { responseType: 'stream' });

    return response$.pipe(
      map(response => response.data as unknown as Readable),
      switchMap(stream => {
        return new Observable<string>(subscriber => {
          let buffer = '';
          stream.on('data', (chunk: Buffer) => {
            buffer += chunk.toString('utf-8');
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.trim().startsWith('data: ')) {
                const data = line.substring(6).trim();
                if (data === '[DONE]') {
                  subscriber.complete();
                  return;
                }
                try {
                  const parsed = JSON.parse(data);
                  let content = '';
                  // Handle OpenAI and Workers AI stream formats
                  if (modelInfo.provider === AiProvider.OPENAI) {
                    content = parsed.choices?.[0]?.delta?.content ?? '';
                  } else if (modelInfo.provider === AiProvider.WORKERS_AI) {
                    content = parsed.response ?? '';
                  }
                  if (content) {
                    subscriber.next(content);
                  }
                } catch (e) { /* Ignore parse errors on partial data */ }
              }
            }
          });
          stream.on('end', () => subscriber.complete());
          stream.on('error', err => subscriber.error(err));
          return () => { if (!stream.destroyed) stream.destroy(); };
        });
      }),
    );
  }

  // Embedding method remains unchanged as it's specific to Workers AI
  async generateEmbeddings(texts: string[], batchSize = 50): Promise<number[][]> {
    const allEmbeddings: number[][] = [];
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const response$ = this.makeRequest<{ data: number[][] } | { result: number[][] } | number[][]>(
        AiProvider.WORKERS_AI,
        this.embeddingModelId,
        { text: batch },
      );
      const response = await firstValueFrom(response$);
      
      // Debug logging to see the actual response structure
      this.logger.debug(`Embedding response structure:`, {
        hasResponse: !!response,
        hasData: !!response?.data,
        responseKeys: response?.data ? Object.keys(response.data) : [],
        responseDataType: typeof response?.data,
        responseDataLength: Array.isArray(response?.data) ? response.data.length : 'not array'
      });
      
      // Handle different possible response structures
      let embeddings: number[][] = [];
      const responseData = response?.data;
      
      if (responseData && typeof responseData === 'object' && 'data' in responseData && Array.isArray(responseData.data)) {
        // Expected structure: { data: number[][] }
        embeddings = responseData.data;
      } else if (Array.isArray(responseData)) {
        // Direct array structure: number[][]
        embeddings = responseData;
      } else if (responseData && typeof responseData === 'object' && 'result' in responseData && responseData.result && typeof responseData.result === 'object' && 'data' in responseData.result && Array.isArray(responseData.result.data)) {
        // Workers AI structure: { result: { data: number[][] } }
        embeddings = responseData.result.data;
      } else {
        this.logger.error('Embedding response structure not recognized:', responseData);
        throw new Error('Embedding generation failed - unexpected response structure');
      }
      
      allEmbeddings.push(...embeddings);
    }
    return allEmbeddings;
  }
} 