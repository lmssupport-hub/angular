import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CreateMeetingModal } from './create-meeting-modal';

describe('CreateMeetingModal', () => {
  let component: CreateMeetingModal;
  let fixture: ComponentFixture<CreateMeetingModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CreateMeetingModal],
    }).compileComponents();

    fixture = TestBed.createComponent(CreateMeetingModal);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
