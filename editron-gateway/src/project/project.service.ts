import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from '../entities/project.entity';
import { User } from '../entities/user.entity';

@Injectable()
export class ProjectService {
  private readonly logger = new Logger(ProjectService.name);

  constructor(
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
  ) {}

  async create(user: User, name: string, description?: string, customInstructions?: string): Promise<Project> {
    const project = this.projectRepository.create({
      user,
      name,
      description,
      customInstructions,
    });

    const savedProject = await this.projectRepository.save(project);
    this.logger.log(`Created project ${savedProject.uuid} for user ${user.id}`);
    
    return savedProject;
  }

  async findAllForUser(userId: number): Promise<Project[]> {
    return this.projectRepository.find({
      where: { user: { id: userId } },
      order: { createdAt: 'DESC' },
    });
  }

  async findByUuid(projectUuid: string, userId: number): Promise<Project> {
    const project = await this.projectRepository.findOne({
      where: { uuid: projectUuid, user: { id: userId } },
      relations: ['user'],
    });

    if (!project) {
      throw new NotFoundException(`Project with UUID ${projectUuid} not found`);
    }

    return project;
  }

  async update(
    projectUuid: string, 
    userId: number, 
    updates: { name?: string; description?: string; customInstructions?: string }
  ): Promise<Project> {
    const project = await this.findByUuid(projectUuid, userId);

    Object.assign(project, updates);
    const updatedProject = await this.projectRepository.save(project);
    
    this.logger.log(`Updated project ${projectUuid} for user ${userId}`);
    return updatedProject;
  }

  async delete(projectUuid: string, userId: number): Promise<void> {
    const project = await this.findByUuid(projectUuid, userId);
    
    await this.projectRepository.remove(project);
    this.logger.log(`Deleted project ${projectUuid} for user ${userId}`);
  }

  async findById(projectId: number): Promise<Project | null> {
    return this.projectRepository.findOne({
      where: { id: projectId },
      relations: ['user'],
    });
  }
} 