import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CreateTaskModal } from './create-task-modal';

describe('CreateTaskModal', () => {
  let component: CreateTaskModal;
  let fixture: ComponentFixture<CreateTaskModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CreateTaskModal],
    }).compileComponents();

    fixture = TestBed.createComponent(CreateTaskModal);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
