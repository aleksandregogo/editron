import { 
  Controller, 
  Post, 
  Get, 
  Patch,
  Delete,
  Param, 
  Body,
  UseGuards,
  Logger,
  HttpCode,
  HttpStatus
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthUser } from '../auth/decorators/auth-user.decorator';
import { UserInfo } from '../auth/interfaces/user-info.interface';
import { ProjectService } from './project.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

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

  @Get(':projectUuid/details')
  async findOne(@AuthUser() userInfo: UserInfo, @Param('projectUuid') projectUuid: string) {
    return this.projectService.findByUuid(projectUuid, userInfo.user.id);
  }

  @Patch(':projectUuid/update')
  async update(
    @AuthUser() userInfo: UserInfo,
    @Param('projectUuid') projectUuid: string,
    @Body() updateProjectDto: UpdateProjectDto
  ) {
    return this.projectService.update(projectUuid, userInfo.user.id, updateProjectDto);
  }

  @Delete(':projectUuid/delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@AuthUser() userInfo: UserInfo, @Param('projectUuid') projectUuid: string) {
    await this.projectService.delete(projectUuid, userInfo.user.id);
  }
} 