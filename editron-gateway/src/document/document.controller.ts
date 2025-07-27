import { 
  Controller, 
  Post, 
  Get, 
  Patch,
  Param, 
  Body,
  UseGuards, 
  UseInterceptors, 
  UploadedFile, 
  ParseFilePipe, 
  MaxFileSizeValidator, 
  FileTypeValidator, 
  Logger,
  HttpCode,
  HttpStatus
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthUser } from '../auth/decorators/auth-user.decorator';
import { UserInfo } from '../auth/interfaces/user-info.interface';
import { DocumentService } from './document.service';
import { AgentRequestDto } from './dto/agent-request.dto';

@UseGuards(AuthGuard('jwt'))
@Controller('projects/:projectUuid/documents')
export class DocumentController {
  private readonly logger = new Logger(DocumentController.name);

  constructor(private readonly documentService: DocumentService) {}

  @Get()
  async listDocuments(@AuthUser() userInfo: UserInfo, @Param('projectUuid') projectUuid: string) {
    return this.documentService.findAllForProject(projectUuid, userInfo.user.id);
  }

  @Get(':uuid')
  async getDocument(
    @AuthUser() userInfo: UserInfo,
    @Param('projectUuid') projectUuid: string,
    @Param('uuid') uuid: string,
  ) {
    return this.documentService.findOneByProject(uuid, projectUuid, userInfo.user.id);
  }

  @Post('upload-and-preview')
  @UseInterceptors(FileInterceptor('file'))
  async uploadAndPreview(
    @AuthUser() userInfo: UserInfo,
    @Param('projectUuid') projectUuid: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }), // 10 MB
          new FileTypeValidator({ 
            fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
          }),
        ],
      }),
    ) file: Express.Multer.File,
  ) {
    this.logger.log(`Received DOCX upload "${file.originalname}" from user ${userInfo.user.id} for project ${projectUuid}`);
    return this.documentService.createFromUpload(
      userInfo.user,
      projectUuid,
      file.buffer,
      file.originalname
    );
  }

  @Patch(':uuid')
  async updateDocument(
    @AuthUser() userInfo: UserInfo,
    @Param('projectUuid') projectUuid: string,
    @Param('uuid') uuid: string,
    @Body() updateData: { content?: string; title?: string },
  ) {
    return this.documentService.updateDocument(uuid, projectUuid, userInfo.user.id, updateData);
  }

  @Post('agent-edit')
  @HttpCode(HttpStatus.OK)
  async agentEdit(
    @AuthUser() userInfo: UserInfo,
    @Param('projectUuid') projectUuid: string,
    @Body() agentRequestDto: AgentRequestDto,
  ) {
    return this.documentService.generateAgentSuggestion(
      userInfo.userLocalId,
      projectUuid,
      agentRequestDto.documentUuid,
      agentRequestDto.promptText,
    );
  }
} 