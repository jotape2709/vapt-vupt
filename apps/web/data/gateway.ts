import type {
 MovementCreate, MovementPage, MovementQuery, MovementRecord, MovementResult, OrgSettings,
 ProductCreate, SettingsEnvelope, StockItem, StockPage, StockQuery
} from '../../../packages/domain/contracts';

/**
 * Camada de acesso a dados do espaço de trabalho. A mesma interface serve a demonstração
 * (sandbox no navegador) e a operação real (API). As telas não sabem qual está em uso.
 *
 * Uma instância vale para UMA organização e UMA unidade. Ao trocar de empresa ou sair,
 * dispose() cancela as requisições pendentes e faz respostas atrasadas serem descartadas.
 */
export interface Gateway {
 readonly mode: 'demo' | 'live';
 readonly organizationId: string;
 readonly unitId: string;
 listStock(query: StockQuery, signal?: AbortSignal): Promise<StockPage>;
 createProduct(input: ProductCreate): Promise<StockItem>;
 move(input: MovementCreate): Promise<MovementResult>;
 /** Reconciliação: o evento existe (registrado) ou null (não registrado; seguro reenviar o mesmo id). */
 findMovement(eventId: string): Promise<MovementRecord | null>;
 listMovements(query: MovementQuery, signal?: AbortSignal): Promise<MovementPage>;
 saveSettings(expectedVersion: number, settings: OrgSettings): Promise<SettingsEnvelope>;
 uploadLogo(file: File): Promise<{ assetId: string; previewUrl: string }>;
 dispose(): void;
}
