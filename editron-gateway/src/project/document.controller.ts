import { 
  Controller, 
  Post, 
  Get, 
  Patch,
  Delete,
  Param, 
  Query,
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
import { ProjectService } from './project.service';
import { AgentRequestDto } from './dto/agent-request.dto';

@UseGuards(AuthGuard('jwt'))
@Controller('documents')
export class DocumentController {
  private readonly logger = new Logger(DocumentController.name);

  constructor(private readonly projectService: ProjectService) {}

  @Get()
  async listDocuments(@AuthUser() userInfo: UserInfo, @Query('projectUuid') projectUuid: string) {
    return this.projectService.findAllDocumentsForProject(projectUuid, userInfo.user.id);
  }

  @Get(':uuid')
  async getDocument(
    @AuthUser() userInfo: UserInfo,
    @Query('projectUuid') projectUuid: string,
    @Param('uuid') uuid: string,
  ) {
    return this.projectService.findDocumentByProject(uuid, projectUuid, userInfo.user.id);
  }

  @Post('upload-and-preview')
  @UseInterceptors(FileInterceptor('file'))
  async uploadAndPreview(
    @AuthUser() userInfo: UserInfo,
    @Query('projectUuid') projectUuid: string,
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
    return this.projectService.createDocumentFromUpload(
      userInfo.user,
      projectUuid,
      file.buffer,
      file.originalname
    );
  }

  @Patch(':uuid')
  async updateDocument(
    @AuthUser() userInfo: UserInfo,
    @Query('projectUuid') projectUuid: string,
    @Param('uuid') uuid: string,
    @Body() updateData: { content?: string; title?: string },
  ) {
    return this.projectService.updateDocument(uuid, projectUuid, userInfo.user.id, updateData);
  }

  @Delete(':uuid')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteDocument(
    @AuthUser() userInfo: UserInfo,
    @Query('projectUuid') projectUuid: string,
    @Param('uuid') uuid: string,
  ) {
    this.logger.log(`Attempting to delete document ${uuid} from project ${projectUuid} for user ${userInfo.user.id}`);
    await this.projectService.deleteDocument(uuid, projectUuid, userInfo.user.id);
    this.logger.log(`Successfully deleted document ${uuid} from project ${projectUuid}`);
  }

  @Post('agent-edit')
  @HttpCode(HttpStatus.OK)
  async agentEdit(
    @AuthUser() userInfo: UserInfo,
    @Query('projectUuid') projectUuid: string,
    @Body() agentRequestDto: AgentRequestDto,
  ) {
    return this.projectService.generateAgentSuggestion(
      userInfo.userLocalId,
      projectUuid,
      agentRequestDto.documentUuid,
      agentRequestDto.promptText,
    );
  }
} 