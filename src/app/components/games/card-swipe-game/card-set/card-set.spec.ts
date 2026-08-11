import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CardSet } from './card-set';

describe('CardSet', () => {
  let component: CardSet;
  let fixture: ComponentFixture<CardSet>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CardSet],
    }).compileComponents();

    fixture = TestBed.createComponent(CardSet);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
