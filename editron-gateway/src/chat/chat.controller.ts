import { Controller, Post, Body, UseGuards, Sse, MessageEvent, Get } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Observable, map, tap, finalize } from 'rxjs';
import { AuthUser } from '../auth/decorators/auth-user.decorator';
import { UserInfo } from '../auth/interfaces/user-info.interface';
import { ChatService } from './chat.service';
import { ChatQueryDto, ChatMode } from './dto/chat-query.dto';
import { ChatHistoryService } from '../chat-history/chat-history.service';
import { ChatMessageRole, ChatMessageMode } from '../entities/chat-message.entity';

@UseGuards(AuthGuard('jwt'))
@Controller('chat')
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly chatHistoryService: ChatHistoryService,
  ) {}

  @Post('query')
  @Sse()
  async streamChatResponse(
    @AuthUser() userInfo: UserInfo,
    @Body() chatQueryDto: ChatQueryDto,
  ): Promise<Observable<MessageEvent>> {
    const { promptText, documentUuid, projectUuid, mode } = chatQueryDto;
    
    await this.chatHistoryService.addMessage(userInfo.userLocalId, ChatMessageRole.USER, promptText);

    let fullAssistantResponse = '';
    
    const responseStream = await this.chatService.processUserQueryStream(
      userInfo,
      promptText,
      documentUuid,
      projectUuid,
    );

    return responseStream.pipe(
      tap(contentChunk => {
        fullAssistantResponse += contentChunk;
      }),
      map((content: string) => ({
        type: 'message',
        data: JSON.stringify({
          type: 'chunk',
          content,
        }),
      } as MessageEvent)),
      finalize(async () => {
        if (fullAssistantResponse.trim()) {
          // Convert ChatMode to ChatMessageMode
          const messageMode = mode === ChatMode.AGENT ? ChatMessageMode.AGENT : ChatMessageMode.CHAT;
          
          await this.chatHistoryService.addMessage(
            userInfo.userLocalId,
            ChatMessageRole.ASSISTANT,
            fullAssistantResponse.trim(),
            undefined,
            messageMode,
          );
        }
      }),
    );
  }

  @Get('history')
  async getHistory(@AuthUser() user: UserInfo) {
    const messages = await this.chatHistoryService.getHistoryForDisplay(user.userLocalId, 50);
    return messages.reverse();
  }
} 