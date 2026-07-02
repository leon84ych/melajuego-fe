import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Configure } from './configure';

describe('Configure', () => {
  let component: Configure;
  let fixture: ComponentFixture<Configure>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Configure]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Configure);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
