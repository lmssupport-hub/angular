import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CreateErrorModal } from './create-error-modal';

describe('CreateErrorModal', () => {
  let component: CreateErrorModal;
  let fixture: ComponentFixture<CreateErrorModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CreateErrorModal],
    }).compileComponents();

    fixture = TestBed.createComponent(CreateErrorModal);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
