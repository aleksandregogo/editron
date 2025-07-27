import { 
  Controller, 
  Post, 
  Get, 
  Patch,
  Delete,
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
import { ProjectService } from './project.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { AgentRequestDto } from './dto/agent-request.dto';

@UseGuards(AuthGuard('jwt'))
@Controller('projects')
export class ProjectController {
  private readonly logger = new Logger(ProjectController.name);

  constructor(private readonly projectService: ProjectService) {}

  @Post()
  async create(@AuthUser() userInfo: UserInfo, @Body() createProjectDto: CreateProjectDto) {
    const { name, description, customInstructions } = createProjectDto;
    return this.projectService.create(userInfo.user, name, description, customInstructions);
  }

  @Get()
  async findAll(@AuthUser() userInfo: UserInfo) {
    return this.projectService.findAllForUser(userInfo.user.id);
  }

  @Get(':projectUuid')
  async findOne(@AuthUser() userInfo: UserInfo, @Param('projectUuid') projectUuid: string) {
    return this.projectService.findByUuid(projectUuid, userInfo.user.id);
  }

  @Patch(':projectUuid')
  async update(
    @AuthUser() userInfo: UserInfo,
    @Param('projectUuid') projectUuid: string,
    @Body() updateProjectDto: UpdateProjectDto
  ) {
    return this.projectService.update(projectUuid, userInfo.user.id, updateProjectDto);
  }

  @Delete(':projectUuid')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@AuthUser() userInfo: UserInfo, @Param('projectUuid') projectUuid: string) {
    await this.projectService.delete(projectUuid, userInfo.user.id);
  }

  // Document endpoints
  @Get(':projectUuid/documents')
  async listDocuments(@AuthUser() userInfo: UserInfo, @Param('projectUuid') projectUuid: string) {
    return this.projectService.findAllDocumentsForProject(projectUuid, userInfo.user.id);
  }

  @Get(':projectUuid/documents/:uuid')
  async getDocument(
    @AuthUser() userInfo: UserInfo,
    @Param('projectUuid') projectUuid: string,
    @Param('uuid') uuid: string,
  ) {
    return this.projectService.findDocumentByProject(uuid, projectUuid, userInfo.user.id);
  }

  @Post(':projectUuid/documents/upload-and-preview')
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
    return this.projectService.createDocumentFromUpload(
      userInfo.user,
      projectUuid,
      file.buffer,
      file.originalname
    );
  }

  @Patch(':projectUuid/documents/:uuid')
  async updateDocument(
    @AuthUser() userInfo: UserInfo,
    @Param('projectUuid') projectUuid: string,
    @Param('uuid') uuid: string,
    @Body() updateData: { content?: string; title?: string },
  ) {
    return this.projectService.updateDocument(uuid, projectUuid, userInfo.user.id, updateData);
  }

  @Post(':projectUuid/documents/agent-edit')
  @HttpCode(HttpStatus.OK)
  async agentEdit(
    @AuthUser() userInfo: UserInfo,
    @Param('projectUuid') projectUuid: string,
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