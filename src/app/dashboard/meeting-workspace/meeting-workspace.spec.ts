import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MeetingWorkspace } from './meeting-workspace';

describe('MeetingWorkspace', () => {
  let component: MeetingWorkspace;
  let fixture: ComponentFixture<MeetingWorkspace>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MeetingWorkspace],
    }).compileComponents();

    fixture = TestBed.createComponent(MeetingWorkspace);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
