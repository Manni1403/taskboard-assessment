import { Test, TestingModule } from '@nestjs/testing';
import { TodosService } from './todos.service';
import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';

describe('TodosService', () => {
  let service: TodosService;
  let prisma: PrismaService;

  const mockPrismaService = {
    todo: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn((cb) => cb(mockPrismaService)),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TodosService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<TodosService>(TodosService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a todo', async () => {
      const dto = { title: 'Test Todo', description: 'Test Description' };
      const userId = 'user-1';
      const expectedTodo = { id: '1', ...dto, ownerId: userId, version: 1 };

      mockPrismaService.todo.create.mockResolvedValue(expectedTodo);

      const result = await service.create(dto, userId);

      expect(result).toEqual(expectedTodo);
      expect(mockPrismaService.todo.create).toHaveBeenCalledWith({
        data: {
          title: 'Test Todo',
          description: 'Test Description',
          ownerId: userId,
        },
      });
    });

    it('should throw BadRequestException if title is empty', async () => {
      const dto = { title: '', description: 'Test Description' };
      const userId = 'user-1';

      await expect(service.create(dto, userId)).rejects.toThrow(BadRequestException);
    });

    it('should sanitize description', async () => {
      const dto = { title: 'Test Todo', description: '<script>alert("xss")</script>Test Description' };
      const userId = 'user-1';
      const expectedTodo = { id: '1', title: dto.title, description: 'Test Description', ownerId: userId, version: 1 };

      mockPrismaService.todo.create.mockResolvedValue(expectedTodo);

      await service.create(dto, userId);

      expect(mockPrismaService.todo.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          description: 'Test Description',
        }),
      });
    });
  });

  describe('findAll', () => {
    it('should return all todos for a user', async () => {
      const userId = 'user-1';
      const todos = [{ id: '1', title: 'Todo 1', ownerId: userId }];

      mockPrismaService.todo.findMany.mockResolvedValue(todos);

      const result = await service.findAll(userId);

      expect(result).toEqual(todos);
      expect(mockPrismaService.todo.findMany).toHaveBeenCalledWith({
        where: { ownerId: userId },
        orderBy: { lastModified: 'desc' },
      });
    });

    it('should filter by completed status', async () => {
      const userId = 'user-1';
      const todos = [{ id: '1', title: 'Todo 1', completed: true, ownerId: userId }];

      mockPrismaService.todo.findMany.mockResolvedValue(todos);

      await service.findAll(userId, 'completed');

      expect(mockPrismaService.todo.findMany).toHaveBeenCalledWith({
        where: { ownerId: userId, completed: true },
        orderBy: { lastModified: 'desc' },
      });
    });
  });

  describe('findOne', () => {
    it('should return a todo if found and owned by user', async () => {
      const userId = 'user-1';
      const todo = { id: '1', title: 'Todo 1', ownerId: userId };

      mockPrismaService.todo.findUnique.mockResolvedValue(todo);

      const result = await service.findOne('1', userId);

      expect(result).toEqual(todo);
    });

    it('should throw NotFoundException if todo not found', async () => {
      const userId = 'user-1';

      mockPrismaService.todo.findUnique.mockResolvedValue(null);

      await expect(service.findOne('1', userId)).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if todo owned by another user', async () => {
      const userId = 'user-1';
      const todo = { id: '1', title: 'Todo 1', ownerId: 'user-2' };

      mockPrismaService.todo.findUnique.mockResolvedValue(todo);

      await expect(service.findOne('1', userId)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('update', () => {
    it('should update a todo', async () => {
      const userId = 'user-1';
      const todo = { id: '1', title: 'Todo 1', ownerId: userId, version: 1 };
      const updateDto = { title: 'Updated Todo', version: 1 };
      const updatedTodo = { ...todo, ...updateDto, version: 2 };

      mockPrismaService.todo.findUnique.mockResolvedValue(todo);
      mockPrismaService.todo.update.mockResolvedValue(updatedTodo);

      const result = await service.update('1', updateDto, userId);

      expect(result).toEqual(updatedTodo);
      expect(mockPrismaService.todo.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: { title: 'Updated Todo', version: 2 },
      });
    });

    it('should throw ConflictException on version mismatch', async () => {
      const userId = 'user-1';
      const todo = { id: '1', title: 'Todo 1', ownerId: userId, version: 2 };
      const updateDto = { title: 'Updated Todo', version: 1 };

      mockPrismaService.todo.findUnique.mockResolvedValue(todo);

      await expect(service.update('1', updateDto, userId)).rejects.toThrow(ConflictException);
    });

    it('should sanitize description on update', async () => {
      const userId = 'user-1';
      const todo = { id: '1', title: 'Todo 1', ownerId: userId, version: 1 };
      const updateDto = { description: '<script>alert("xss")</script>Updated', version: 1 };

      mockPrismaService.todo.findUnique.mockResolvedValue(todo);
      mockPrismaService.todo.update.mockResolvedValue({ ...todo, description: 'Updated', version: 2 });

      await service.update('1', updateDto, userId);

      expect(mockPrismaService.todo.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: expect.objectContaining({ description: 'Updated' }),
      });
    });
  });

  describe('remove', () => {
    it('should delete a todo', async () => {
      const userId = 'user-1';
      const todo = { id: '1', title: 'Todo 1', ownerId: userId };

      mockPrismaService.todo.findUnique.mockResolvedValue(todo);

      await service.remove('1', userId);

      expect(mockPrismaService.todo.delete).toHaveBeenCalledWith({
        where: { id: '1' },
      });
    });
  });

  describe('bulkCreate', () => {
    it('should create multiple todos', async () => {
      const userId = 'user-1';
      const dto = { todos: [{ title: 'Todo 1' }, { title: 'Todo 2' }] };
      const createdTodos = [
        { id: '1', title: 'Todo 1', ownerId: userId },
        { id: '2', title: 'Todo 2', ownerId: userId },
      ];

      mockPrismaService.todo.create
        .mockResolvedValueOnce(createdTodos[0])
        .mockResolvedValueOnce(createdTodos[1]);

      const result = await service.bulkCreate(dto, userId);

      expect(result).toEqual(createdTodos);
      expect(mockPrismaService.todo.create).toHaveBeenCalledTimes(2);
    });

    it('should throw BadRequestException if any title is empty', async () => {
      const userId = 'user-1';
      const dto = { todos: [{ title: 'Todo 1' }, { title: '' }] };

      await expect(service.bulkCreate(dto, userId)).rejects.toThrow(BadRequestException);
    });
  });

  describe('bulkDelete', () => {
    it('should delete multiple todos owned by user', async () => {
      const userId = 'user-1';
      const dto = { ids: ['1', '2', '3'] };
      const userTodos = [{ id: '1', ownerId: userId }, { id: '2', ownerId: userId }];

      mockPrismaService.todo.findMany.mockResolvedValue(userTodos);

      const result = await service.bulkDelete(dto, userId);

      expect(result).toEqual({
        deleted: ['1', '2'],
        notFound: ['3'],
      });
      expect(mockPrismaService.todo.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ['1', '2'] } },
      });
    });
  });
});
