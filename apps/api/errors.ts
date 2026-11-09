import type { ErrorBody, ErrorCode } from '../../packages/domain/contracts';

/** Erro de negócio com código estável; a mensagem é exibível ao usuário. */
export class ApiError extends Error {
 constructor(readonly statusCode: number, readonly code: ErrorCode, message: string, readonly extra: Omit<ErrorBody, 'error' | 'message'> = {}) {
  super(message);
 }
 body(): ErrorBody { return { error: this.code, message: this.message, ...this.extra }; }
}

export const forbidden = () => new ApiError(403, 'forbidden', 'Acesso não permitido para esta empresa ou função.');
export const notFound = (what = 'Registro') => new ApiError(404, 'not_found', `${what} não encontrado.`);
