
import { Test, TestingModule } from '@nestjs/testing';
import { LandingController } from './landing.controller';
import { LandingService } from './landing.service';

describe('LandingController', () => {
  let controller: LandingController;
  let service: LandingService;

  const mockService = {
    getSettings: jest.fn(),
    getHome: jest.fn(),
    getAbout: jest.fn(),
    getPrograms: jest.fn(),
    getProgramDetail: jest.fn(),
    getPartnersSponsors: jest.fn(),
    getAnnouncements: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LandingController],
      providers: [
        { provide: LandingService, useValue: mockService },
      ],
    }).compile();

    controller = module.get<LandingController>(LandingController);
    service = module.get<LandingService>(LandingService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getSettings', () => {
    it('should prefer URL query param', async () => {
      await controller.getSettings('ybb.co');
      expect(mockService.getSettings).toHaveBeenCalledWith('ybb.co');
    });

    it('should fallback to header if URL missing', async () => {
        await controller.getSettings('other.com');
        expect(mockService.getSettings).toHaveBeenCalledWith('other.com');
    });
  });

  describe('getHome', () => {
    it('should delegate to service', async () => {
        await controller.getHome('ybb.co');
        expect(mockService.getHome).toHaveBeenCalledWith('ybb.co');
    });
  });

  describe('getProgramDetail', () => {
    it('should pass slug and url', async () => {
        await controller.getProgramDetail('my-slug', 'ybb.co');
        expect(mockService.getProgramDetail).toHaveBeenCalledWith('my-slug', 'ybb.co');
    });
  });
});
