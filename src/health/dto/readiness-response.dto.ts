export class ReadinessResponseDto {
  status: 'ok' | 'error';
  checks: {
    database: 'up' | 'down';
  };
}
