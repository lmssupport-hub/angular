import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CreateProjectModal } from './create-project-modal';

describe('CreateProjectModal', () => {
  let component: CreateProjectModal;
  let fixture: ComponentFixture<CreateProjectModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CreateProjectModal],
    }).compileComponents();

    fixture = TestBed.createComponent(CreateProjectModal);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
