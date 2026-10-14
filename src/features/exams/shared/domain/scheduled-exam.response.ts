export interface ScheduledExamResponse {
  authorized: false;
  examId: string;
  status: 'SCHEDULED';
  startsAt: Date;
  message: string;
}

export function scheduledExamResponse(
  examId: string,
  startsAt: Date,
): ScheduledExamResponse {
  return {
    authorized: false,
    examId,
    status: 'SCHEDULED',
    startsAt,
    message:
      'The exam has not started yet. Please return at the scheduled start time.',
  };
}
