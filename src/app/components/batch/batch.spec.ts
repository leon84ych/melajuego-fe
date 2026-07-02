import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Batch } from './batch';

describe('Batch', () => {
  let component: Batch;
  let fixture: ComponentFixture<Batch>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Batch]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Batch);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
