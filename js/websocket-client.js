export class RankingWebSocket {
    constructor() {
        // URL original del Trabajo Práctico (inactiva)
        this.originalUrl = "wss://gamehubmanager.azurewebsites.net/ws";
        
        // Alternativa propuesta: Servidor de prueba o local (Punto 2)
        // Se puede usar ws://localhost:8080 si se levanta un servidor de node/python, 
        // o un echo server público como wss://echo.websocket.events/ para probar el envío y recepción.
        this.alternativeUrl = "wss://echo.websocket.events/"; 
        
        // Bandera para decidir si usamos la alternativa o no
        this.useAlternative = false; 
        
        this.playerName = localStorage.getItem("tetris_player") || "Jugador" + Math.floor(Math.random() * 1000);
        this.ws = null;
    }

    init() {
        const statusEl = document.getElementById('fb-status');
        
        // Elegimos qué URL usar basándonos en la bandera
        const targetUrl = this.useAlternative ? this.alternativeUrl : this.originalUrl;
        
        if (statusEl) {
            statusEl.textContent = '⬤ WS CONECTANDO...';
            statusEl.style.color = '#ffd60a'; // Amarillo
        }
        
        this.createRankingContainer();

        try {
            this.ws = new WebSocket(targetUrl);
            
            this.ws.onopen = () => {
                if (statusEl) {
                    statusEl.textContent = '⬤ WS ONLINE';
                    statusEl.style.color = '#30d158'; // Verde
                }
                console.log("Conectado exitosamente al WebSocket:", targetUrl);
                // Si pudimos conectar (por ej. si el server original vuelve a funcionar), 
                // limpiamos el mensaje de "Offline"
                this.updateRankingUI([{Player: "Servidor", Value: "Esperando datos..."}]);
            };

            this.ws.onmessage = (event) => {
                try {
                    let data = JSON.parse(event.data);
                    
                    if (typeof data === 'string') {
                        data = JSON.parse(data);
                    }
                    
                    if (Array.isArray(data)) {
                        this.updateRankingUI(data);
                    } else if (data.game) {
                        this.updateRankingUI([{ Player: data.player, Value: data.value }]);
                    }
                } catch (e) {
                    console.log("Mensaje WS recibido (no parseable):", event.data);
                }
            };

            this.ws.onerror = (e) => {
                if (statusEl) {
                    statusEl.textContent = '⬤ WS INACTIVO';
                    statusEl.style.color = '#ff375f'; // Rojo
                }
                
                // Si estábamos intentando conectar al original y falló, mostramos el mensaje solicitado
                if (!this.useAlternative) {
                    console.warn("El servidor " + this.originalUrl + " está inactivo o inaccesible.");
                    this.updateRankingUI([{Player: "Servidor", Value: "Offline"}]);
                    
                    // Mostramos el alert solo 1 vez cuando falla
                    alert(`El servidor WebSocket original (${this.originalUrl}) se encuentra inactivo y no se pudo conectar.\n\nAlternativa propuesta: Se preparó el código para conectarse a un servidor de prueba (por ej. wss://echo.websocket.events/). Cambie 'this.useAlternative = true' en js/websocket-client.js para probar la conexión alternativa.`);
                } else {
                    console.error("Error en WebSocket alternativo.");
                }
            };
            
            this.ws.onclose = () => {
                if (statusEl && statusEl.textContent !== '⬤ WS INACTIVO') {
                    statusEl.textContent = '⬤ WS CERRADO';
                    statusEl.style.color = '#ff9f0a'; // Naranja
                }
            };
        } catch (e) {
            console.error("Excepción al iniciar WS:", e);
        }
    }

    sendEvent(eventName, value) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            const payload = {
                game: "Tetris",
                event: eventName,
                player: this.playerName,
                value: value
            };
            this.ws.send(JSON.stringify(payload));
        }
    }

    createRankingContainer() {
        if (document.getElementById('ws-ranking')) return;
        
        const container = document.createElement('div');
        container.id = 'ws-ranking';
        container.className = 'stat-box';
        container.style.marginTop = '20px';
        container.innerHTML = `
            <span class="stat-label" style="color: #30d158;">LIVE RANKING</span>
            <div id="ws-ranking-list" style="font-size: 12px; color: white; margin-top: 8px; line-height: 1.4;">
                Buscando...
            </div>
        `;
        
        // Insertamos el ranking en el panel lateral izquierdo
        const leftPanel = document.querySelector('.panel--left');
        if (leftPanel) {
            leftPanel.appendChild(container);
        }
    }

    updateRankingUI(rankingArray) {
        const list = document.getElementById('ws-ranking-list');
        if (!list) return;
        
        let html = '';
        rankingArray.slice(0, 5).forEach((item, index) => {
            html += `<div>
                <span style="color: #ffd60a;">#${index+1}</span> ${item.Player.substring(0, 8)}: <span style="color: #c77dff">${item.Value}</span>
            </div>`;
        });
        list.innerHTML = html || 'Sin datos';
    }
}

export const wsClient = new RankingWebSocket();
