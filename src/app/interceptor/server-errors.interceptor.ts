import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest, HttpResponse } from "@angular/common/http";
import { Router } from "@angular/router";
import { EMPTY, Observable, catchError, tap } from "rxjs";
import { Injectable } from "@angular/core";
import { NotificacionService } from "../services/notificacion-service";

@Injectable({
    providedIn: 'root'
})
export class ServerErrorsInterceptor implements HttpInterceptor{

    constructor(
        private noti: NotificacionService,
        private router: Router
    ){}


    intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
        
        return next.handle(req)
            .pipe(tap(event => {
                if(event instanceof HttpResponse){
                    if (event.body && event.body.error === true && event.body.errorMessage) {
                        throw new Error(event.body.errorMessage);
                    }/*else{
                        this.snackBar.open('SUCCESS', 'INFO', { duration: 2000});
                    }*/
                }
            })).pipe(catchError( (err) => {
                if(err.status === 400){
                    //console.log(err);
                    this.noti.error(err?.message || 'Solicitud inválida (400)', { duracion: 5000 });
                }
                else if (err.status === 404){
                    this.noti.error('No existe el recurso (404)', { duracion: 5000 });
                }
                else if (err.status === 403 || err.status === 401) {
                    //console.log(err);
                    this.noti.error(err?.error?.message || 'Acceso no autorizado (401/403)', { duracion: 5000 });
                    //sessionStorage.clear();
                    //this.router.navigate(['/login']);
                }
                else if (err.status === 500) {
                    this.noti.error(err?.error?.message || 'Error interno del servidor (500)', { duracion: 5000 });
                } 
                else {
                    this.noti.error(err?.error?.message || 'Error inesperado', { duracion: 5000 });
                }

                return EMPTY;
            }));

    }
    
}
