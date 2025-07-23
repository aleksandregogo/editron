import { Controller, Post, Body, UseGuards, Sse, MessageEvent } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Observable, map } from 'rxjs';
import { AuthUser } from '../auth/decorators/auth-user.decorator';
import { UserInfo } from '../auth/interfaces/user-info.interface';
import { ChatService } from './chat.service';
import { ChatQueryDto } from './dto/chat-query.dto';

@UseGuards(AuthGuard('jwt'))
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('query')
  @Sse()
  async streamChatResponse(
    @AuthUser() userInfo: UserInfo,
    @Body() chatQueryDto: ChatQueryDto,
  ): Promise<Observable<MessageEvent>> {
    const responseStream = await this.chatService.processUserQueryStream(
      userInfo,
      chatQueryDto.promptText,
      chatQueryDto.documentUuid,
      chatQueryDto.mode,
    );

    return responseStream.pipe(
      map((content: string) => ({
        type: 'message',
        data: JSON.stringify({
          type: 'chunk',
          content,
        }),
      } as MessageEvent))
    );
  }
} 