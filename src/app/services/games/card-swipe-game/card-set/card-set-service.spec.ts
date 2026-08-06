import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { CardSetService } from './card-set-service';

describe('CardSetService', () => {
  let service: CardSetService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });
    service = TestBed.inject(CardSetService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should expose default batch state', () => {
    expect(service.batchSize).toBe(10);
    expect(service.batchResults()).toHaveLength(10);
    expect(service.batchResults().every((result) => result === 'pending')).toBeTrue();
  });
});
