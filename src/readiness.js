const http = require('http');
const DEFAULT_CONTENT_TYPE = {'Content-Type': 'text/html'};

module.exports = class ReadinessProbe {
    constructor(Component) {
        this.Component = Component;
        this.config = Component.readinessConfig;
        this.SERVICES = {};
        this.SERVICES_MONITORED = 0;
        this.SERVICE_READY = false;
        this.SERVICE_HAS_BEEN_READY = false;
        this.SERVICE_STATUS = {
            SERVICE_READY: this.SERVICE_READY,
            SERVICE_HAS_BEEN_READY: this.SERVICE_HAS_BEEN_READY,
            SERVICES_MONITORED: this.SERVICES_MONITORED,
            SERVICES: this.SERVICES,
        };

        if (!this.config.services || !Array.isArray(this.config.services) || this.config.services.length === 0) {
            this.SERVICE_READY = true;
            this.Component.emit('ready');
        } else {
            for (const service in this.config.services) {
                this.SERVICES_MONITORED++;
                this.SERVICES[this.config.services[service]] = {
                    connectedCount: 0,
                };
            }
        }

        const self = this;
        http.createServer(function readinessChecker(req, res) {
            if (req.url === '/liveness') {
                res.writeHead(200, DEFAULT_CONTENT_TYPE);
                res.write('OK');
            } else if (req.url === '/readiness') {
                if (self.SERVICE_READY) {
                    res.writeHead(200, DEFAULT_CONTENT_TYPE);
                    res.write('OK');
                } else {
                    res.writeHead(503, DEFAULT_CONTENT_TYPE);
                    res.write('KO');
                }
            } else {
                res.writeHead(404, DEFAULT_CONTENT_TYPE);
                res.write('Not found!');
            }
            res.end();
        }).listen(this.config.httpPort);
    }

    __updateReadiness() {
        if (this.SERVICES_MONITORED === 0) {
            return;
        }
        let servicesReady = 0;
        for (const property in this.SERVICES) {
            if (this.SERVICES[property].connectedCount > 0) {
                servicesReady++;
            }
        }
        if (Object.keys(this.SERVICES).length === servicesReady) {
            this.SERVICE_READY = true;
            if (this.SERVICE_HAS_BEEN_READY) {
                this.Component.emit('reready');
            } else {
                this.Component.emit('ready');
            }
            this.SERVICE_HAS_BEEN_READY = true;
        } else {
            this.SERVICE_READY = false;
            if (this.SERVICE_HAS_BEEN_READY) {
                this.Component.emit('unready', this.SERVICE_STATUS);
            } else {
                this.Component.emit('notready', this.SERVICE_STATUS);
            }
        }
    }

    checkReady(emit) {
        if (emit) {
            this.__updateReadiness();
        }
        return this.SERVICE_STATUS;
    };

    addService(service) {
        if (this.SERVICES_MONITORED === 0) {
            return;
        }
        if (this.SERVICES[service]) {
            this.SERVICES[service].connectedCount++;
        }
        this.__updateReadiness();
    };

    removeService(service) {
        if (this.SERVICES_MONITORED === 0) {
            return;
        }
        if (this.SERVICES[service]) {
            this.SERVICES[service].connectedCount--;
        }
        this.__updateReadiness();
    };
};
