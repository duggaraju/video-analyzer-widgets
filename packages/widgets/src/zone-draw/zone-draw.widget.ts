import { customElement, attr, FASTElement, observable } from '@microsoft/fast-element';
import { IPoint } from '../../../common/drawer-canvas/drawer-canvas.definitions';
import { guid } from '../../../common/utils/guid';
import { DrawingColors } from '../../../styles/system-providers/ava-design-system-provider.definitions';
import { UIActionType } from '../../../web-components/src/actions-menu/actions-menu.definitions';
import { LayerLabelComponent } from '../../../web-components/src/layer-label/layer-label.component';
import { ILayerLabelConfig, LayerLabelMode } from '../../../web-components/src/layer-label/layer-label.definitions';
import { LineDrawerComponent } from '../../../web-components/src/line-drawer/line-drawer.component';
import { PolygonDrawerComponent } from '../../../web-components/src/polygon-drawer/polygon-drawer.component';
import { ZoneDrawMode, IZone, IZoneDrawWidgetConfig, IZoneOutput } from './zone-draw.definitions';
import { styles } from './zone-draw.style';
import { template } from './zone-draw.template';
import { ZonesViewComponent } from './../../../web-components/src/zones-view/zones-view.component';
import { DELETE_SVG_PATH, RENAME_SVG_PATH } from '../../../styles/svg/svg.shapes';

@customElement({
    name: 'zone-draw-widget',
    template,
    styles
})
export class ZoneDrawWidget extends FASTElement {
    @attr
    public config: IZoneDrawWidgetConfig;

    @observable
    public zones: IZone[] = [];
    @observable
    public isReady = false;
    @observable
    public isDirty = false;
    @observable
    showDrawer = true;
    @observable
    isLineDrawMode = true;
    @observable
    isLabelsListEmpty = true;

    public zoneDrawMode = ZoneDrawMode.Line;

    private readonly MAX_ZONES = 10;

    private zonesView: ZonesViewComponent;
    private lineDrawer: LineDrawerComponent;
    private polygonDrawer: PolygonDrawerComponent;
    private labelsList: HTMLElement;
    private labelListIndex = 1;

    public constructor() {
        super();
    }

    // Only after creation of the template, the canvas element is created and assigned to DOM
    public connectedCallback() {
        super.connectedCallback();

        this.isReady = true;
        this.initZoneDrawComponents();
        window.addEventListener('resize', () => {
            const rvxContainer = this.shadowRoot.querySelector('.rvx-widget-container');
            this.labelsList.style.maxHeight = `${rvxContainer.clientHeight}px`;
        });

        window.addEventListener('labelActionClicked', (e: any) => {
            console.log(e);
            switch (e.detail?.type) {
                case UIActionType.RENAME:
                    this.renameZone(e.detail.id);
                    console.log('RENAME');
                    return;
                case UIActionType.DELETE:
                    console.log('DELETE');
                    this.deleteZone(e.detail.id);
                    return;
            }
        });

        window.addEventListener('labelTextChanged', (e: any) => {
            console.log('labelTextChanged');
            console.log(e);
            for (const zone of this.zones) {
                if (zone.id === e.detail.id) {
                    zone.name = e.detail.name;
                    return;
                }
            }
        });
    }

    public configChanged() {
        setTimeout(() => {
            if (this.isReady) {
                this.initZoneDrawComponents();
            }
        });
    }

    public lineDrawerConnectedCallback() {
        console.log('lineDrawerConnectedCallback');
        setTimeout(() => {
            this.initDrawer();
        });
    }

    public polygonDrawerConnectedCallback() {
        console.log('lineDrawerConnectedCallback');
        setTimeout(() => {
            this.initDrawer();
        });
    }

    private initZoneDrawComponents() {
        if (!this.labelsList) {
            this.labelsList = this.shadowRoot.querySelector('.labels-list');
        }

        this.initZones();
    }

    public close() {
        console.log('close');
    }
    public save() {
        console.log('save');
        const outputs = this.getZonesOutputs();
        console.log(outputs);
        this.$emit('zoneDrawComplete', outputs);
    }
    public done() {
        console.log('done');
        const outputs = this.getZonesOutputs();
        console.log(outputs);
        this.$emit('zoneDrawComplete', outputs);
    }

    private initDrawer() {
        if (this.isLineDrawMode) {
            if (this.lineDrawer) {
                return;
            }
            this.lineDrawer = this.shadowRoot.querySelector('media-line-drawer');

            this.lineDrawer?.setAttribute('borderColor', this.getNextColor());

            this.lineDrawer?.addEventListener('drawerComplete', this.drawerComplete.bind(this));
        } else {
            // init polygon drawer
            this.polygonDrawer = this.shadowRoot.querySelector('media-polygon-drawer');

            this.polygonDrawer?.setAttribute('borderColor', this.getNextColor());

            this.polygonDrawer?.addEventListener('drawerComplete', this.drawerComplete.bind(this));
        }
    }

    private destroyDrawer() {
        if (this.isLineDrawMode) {
            this.lineDrawer?.removeEventListener('drawerComplete', this.drawerComplete);
            this.lineDrawer = null;
        } else {
            this.polygonDrawer?.removeEventListener('drawerComplete', this.drawerComplete);
            this.polygonDrawer = null;
        }
    }

    private drawerComplete(e: any) {
        console.log(e.detail);
        this.createZone([...e.detail]);
    }

    public toggleDrawMode() {
        this.destroyDrawer();
        this.isLineDrawMode = !this.isLineDrawMode;
        // setTimeout(() => {
        //     this.initDrawer();
        // }, 50);
    }

    private initZones() {
        if (this.config) {
            for (const zone of this.config.zones) {
                this.addZone(zone);
            }
        }

        this.isDirty = false;
        if (!this.zonesView) {
            this.zonesView = this.shadowRoot.querySelector('media-zones-view');
        }

        if (this.zones.length) {
            this.zonesView.zones = [...this.zones];
        }
    }

    private createZone(points: IPoint[]) {
        const zone: IZone = {
            id: guid(),
            name: this.getNewZoneName(),
            color: this.getNextColor(),
            points: [...points]
        };

        this.addZone(zone);
    }

    private addZone(newZone: IZone) {
        const zone: IZone = {
            id: newZone.id || guid(),
            name: newZone.name || this.getNewZoneName(),
            color: newZone.color || this.getNextColor(),
            points: [...newZone.points]
        };

        this.zones.push(zone);
        this.zonesView.zones = [...this.zones];

        if (this.lineDrawer) {
            this.lineDrawer.borderColor = this.getNextColor();
        } else {
            this.polygonDrawer?.setAttribute('borderColor', this.getNextColor());
        }

        if (this.zones.length === this.MAX_ZONES) {
            this.showDrawer = false;
            this.destroyDrawer();
        }

        this.isLabelsListEmpty = false;
        this.isDirty = true;

        this.addLabel(zone);
    }

    private deleteZone(id: string) {
        this.zones = this.zones.filter((zone) => zone.id !== id);
        this.zonesView.zones = [...this.zones];
        this.removeLabel(id);
        this.isLabelsListEmpty = this.zones.length === 0;

        if (!this.showDrawer) {
            this.showDrawer = true;
        }
    }

    private getNewZoneName(): string {
        return `${this.isLineDrawMode ? 'Line' : 'Zone'} ${this.labelListIndex++}`;
    }

    private getNextColor(): string {
        for (const color of Object.values(DrawingColors)) {
            const zone = this.zones.filter((a) => a.color === color);
            if (!zone.length) {
                return color;
            }
        }
        return '';
    }

    private addLabel(zone: IZone) {
        const li = window.document.createElement('li');
        const layerLabel = <LayerLabelComponent>window.document.createElement('media-layer-label');
        li.id = zone.id;
        layerLabel.config = this.getLabelConfig(zone);
        li.appendChild(layerLabel);
        this.labelsList.appendChild(li);
    }

    private renameZone(id: string) {
        const li = this.shadowRoot.getElementById(id);
        const layerLabel = <LayerLabelComponent>li.querySelector('media-layer-label');
        layerLabel.editMode = true;
    }

    private labelActionClicked(e: any) { }

    private removeLabel(id: string) {
        const li = this.shadowRoot.getElementById(id);
        this.labelsList.removeChild(li);
    }

    public getLabelConfig(zone: IZone): ILayerLabelConfig {
        console.log(zone);
        return {
            id: zone.id,
            label: zone.name,
            color: zone.color,
            mode: LayerLabelMode.Actions,
            actions: [
                {
                    label: 'Rename',
                    svgPath: RENAME_SVG_PATH,
                    type: UIActionType.RENAME
                },
                {
                    label: 'Delete',
                    svgPath: DELETE_SVG_PATH,
                    type: UIActionType.DELETE
                }
            ]
        };
    }

    private getZonesOutputs(): IZoneOutput[] {
        const outputs: IZoneOutput[] = [];
        for (const zone of this.zones) {
            const output: IZoneOutput = {
                '@type': '#Microsoft.VideoAnalyzer',
                name: zone.name
            };

            if (zone.points.length === 2) {
                output['@type'] += '.NamedLineString';
                output.line = zone.points;
            } else {
                output['@type'] += '.NamedPolygonString';
                output.polygon = zone.points;
            }

            outputs.push(output);
        }

        return outputs;
    }
}
