import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Producto } from '../models/producto.model';

export interface AlertItem {
    key: string;                   
    code: 'STOCK_BELOW_MIN' | 'STOCK_ABOVE_MAX';
    producto_id: number;
    title: string;
    message: string;
    meta: { min?: number; max?: number; actual: number; nombre: string };
    ts: number;
}

@Injectable({ providedIn: 'root' })
export class AlertsService {
    private http = inject(HttpClient);
    private baseProd = `${environment.apiBaseUrl}/productos`;

    private alertsSub = new BehaviorSubject<AlertItem[]>([]);
    alerts$: Observable<AlertItem[]> = this.alertsSub.asObservable();

    private pollTimer: any = null;

    constructor() {
        this.refresh();

        this.pollTimer = setInterval(() => this.refresh(), 6000);

        const onVisible = () => {
            if (document.visibilityState === 'visible') this.refresh();
        };
        document.addEventListener('visibilitychange', onVisible);
    }

    refresh() {
        this.http.get<Producto[]>(this.baseProd).subscribe({
            next: (rows) => this.alertsSub.next(this.buildAlertsFromProducts(Array.isArray(rows) ? rows : [])),
            error: () => this.alertsSub.next([]),
        });
    }

    private buildAlertsFromProducts(products: any[] = []): AlertItem[] {
        const uniq = new Map<string, AlertItem>();

        for (const p of products) {
            const id = Number(p.id_producto);
            const nombre = p.nombre_producto;
            const min = Number(p.stock_minimo ?? 0);
            const max = Number(p.stock_maximo ?? 0);
            const actual = Number(p.stock_actual ?? 0);

            if (Number.isFinite(min) && Number.isFinite(actual) && actual < min) {
                const key = `MIN:${id}`;
                uniq.set(key, {
                    key,
                    code: 'STOCK_BELOW_MIN',
                    producto_id: id,
                    title: 'Alerta de inventario',
                    message: `El producto "${nombre}" está por debajo del mínimo configurado.`,
                    meta: { min, actual, nombre },
                    ts: Date.now(),
                });
            }

            if (Number.isFinite(max) && Number.isFinite(actual) && actual > max) {
                const key = `MAX:${id}`;
                uniq.set(key, {
                    key,
                    code: 'STOCK_ABOVE_MAX',
                    producto_id: id,
                    title: 'Alerta de inventario',
                    message: `El producto "${nombre}" supera el máximo configurado.`,
                    meta: { max, actual, nombre },
                    ts: Date.now(),
                });
            }
        }

        return Array.from(uniq.values()).sort((a, b) => a.producto_id - b.producto_id);
    }
}
