/*
 * Copyright (c) 2023 Huawei Device Co., Ltd.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

let fs = globalThis.requireNapi('file.fs');
let hilog = globalThis.requireNapi('hilog');
let configPolicy = globalThis.requireNapi('configPolicy');
let LightWeightMap = globalThis.requireNapi('util.LightWeightMap');
let rpc = globalThis.requireNapi('rpc');
let util = globalThis.requireNapi('util');
const READ_FILE_BUFFER_SIZE = 4096;
const HILOG_DOMAIN_CODE = 65280;
const DEFAULT_MIN_SHOW_RATIO = 50;
const CUSTOMIZED_RENDERING = 3;
const CLICK = 0;
const IMP = 1;
const CLOSE = 2;
const CODE_SUCCESS = 200;
const SET_CALLBACK = 6;
const REGISTERE = 1;
const UNREGISTERE = 0;

class AdFailCallbackStub extends rpc.RemoteObject {
  constructor(component) {
    super('AdFailCallbackDescriptor');
    this.component = component;
  }

  onRemoteMessageRequest(code, data, reply, options) {
    this.component.handleUIFail();
    return true;
  }
}

class AdComponent extends ViewPU {
  constructor(x, p1, q1, r = -1, r1 = undefined, s1) {
    super(x, q1, r, s1);
    if (typeof r1 === 'function') {
      this.paramsGenerator_ = r1;
    }
    this.ads = [];
    this.displayOptions = {};
    this.interactionListener = null;
    this.want = null;
    this.map = new LightWeightMap();
    this.ratios = [];
    this.remoteObj = null;
    this.connection = -1;
    this.isAdRenderer = false;
    this.context = getContext(this);
    this.eventUniqueId = '';
    this.uniqueId = '';
    this.uiExtProxy = null;
    this.isVisibleBeforeRemoteReady = false;
    this.currentRatioBeforeRemoteReady = 0;
    this.__showComponent = new ObservedPropertySimplePU(false, this, 'showComponent');
    this.__Behavior = new ObservedPropertySimplePU(HitTestMode.Default, this, 'Behavior');
    this.__uecHeight = new ObservedPropertySimplePU('100%', this, 'uecHeight');
    this.adRenderer = this.Component;
    this.__rollPlayState = new SynchedPropertySimpleOneWayPU(p1.rollPlayState, this, 'rollPlayState');
    this.AdFailCallbackStub = null;
    this.failCallbackStub = null;
    this.isRegisterFailCallback = false;
    this.setInitiallyProvidedValue(p1);
    this.declareWatch('rollPlayState', this.onRollPlayStateChange);
  }

  setInitiallyProvidedValue(p1) {
    const properties = [
      'ads',
      'displayOptions',
      'interactionListener',
      'want',
      'map',
      'ratios',
      'remoteObj',
      'connection',
      'isAdRenderer',
      'context',
      'eventUniqueId',
      'uniqueId',
      'uiExtProxy',
      'isVisibleBeforeRemoteReady',
      'currentRatioBeforeRemoteReady',
      'showComponent',
      'Behavior',
      'uecHeight',
      'adRenderer',
    ];

    properties.forEach(prop => {
      if (p1[prop] !== undefined) {
        this[prop] = p1[prop];
      }
    });

    if (p1.rollPlayState === undefined) {
      this.__rollPlayState.set(2);
    }
  }

  updateStateVars(p1) {
    this.__rollPlayState.reset(p1.rollPlayState);
  }

  purgeVariableDependenciesOnElmtId(o1) {
    this.__showComponent.purgeDependencyOnElmtId(o1);
    this.__Behavior.purgeDependencyOnElmtId(o1);
    this.__uecHeight.purgeDependencyOnElmtId(o1);
    this.__rollPlayState.purgeDependencyOnElmtId(o1);
  }

  aboutToBeDeleted() {
    this.__showComponent.aboutToBeDeleted();
    this.__Behavior.aboutToBeDeleted();
    this.__uecHeight.aboutToBeDeleted();
    this.__rollPlayState.aboutToBeDeleted();
    SubscriberManager.Get().delete(this.id__());
    this.aboutToBeDeletedInternal();
  }

  get showComponent() {
    return this.__showComponent.get();
  }

  set showComponent(n1) {
    this.__showComponent.set(n1);
  }

  get Behavior() {
    return this.__Behavior.get();
  }

  set Behavior(n1) {
    this.__Behavior.set(n1);
  }

  get uecHeight() {
    return this.__uecHeight.get();
  }

  set uecHeight(n1) {
    this.__uecHeight.set(n1);
  }

  get rollPlayState() {
    return this.__rollPlayState.get();
  }

  set rollPlayState(n1) {
    this.__rollPlayState.set(n1);
  }

  onRollPlayStateChange() {
    hilog.info(HILOG_DOMAIN_CODE, 'AdComponent', `onRollPlayStateChange: ${this.rollPlayState}.`);
    if (this.uiExtProxy) {
      this.uiExtProxy.send({
        'type': 'rollPlayControlData',
        'rollPlayState': this.rollPlayState,
      });
    }
  }

  getRatios() {
    let t;
    if (((t = this.ads[0]) === null || t === void 0 ? void 0 : t.adType) === 3) {
      let s;
      const u = (s = this.ads[0].minEffectiveShowRatio) !== null && s !== void 0 ? s : DEFAULT_MIN_SHOW_RATIO;
      hilog.debug(HILOG_DOMAIN_CODE, 'AdComponent', `AdComponent minEffectiveShowRatio:${u / 100}`);
      let k1 = [];
      k1.push(u / 100);
      for (let m1 = 0; m1 <= 100; m1 += 5) {
        k1.push(m1 / 100);
      }
      const l1 = Array.from(new Set(k1));
      hilog.debug(HILOG_DOMAIN_CODE, 'AdComponent', `AdComponent ratios: ${l1}`);
      return l1;
    } else {
      hilog.debug(HILOG_DOMAIN_CODE, 'AdComponent', `AdComponent ratios: ${[0, 1]}`);
      return [0, 1];
    }
  }

  createRpcData(u, w) {
    let y = rpc.MessageSequence.create();
    hilog.debug(HILOG_DOMAIN_CODE, 'AdComponent', `remote descriptor: ${this.remoteObj?.getDescriptor()}`);
    y.writeInterfaceToken(this.remoteObj?.getDescriptor());
    y.writeInt(u);
    y.writeString(this.eventUniqueId);
    y.writeString(this.uniqueId);
    if (w !== null && w !== undefined) {
      y.writeString(this.getMillis());
      y.writeFloat(w);
    }
    return y;
  }

  initIds() {
    let t;
    this.eventUniqueId = util.generateRandomUUID(true);
    this.uniqueId = (t = this.ads[0]) === null || t === void 0 ? void 0 : t.uniqueId;
  }

  getMillis() {
    return Date.now().toString();
  }

  getMillisStr() {
    return Date.now().toString();
  }

  async sendDataRequest(u, w) {
    let t;
    const y = this.createRpcData(u, w);
    if (this.remoteObj === null) {
      hilog.error(HILOG_DOMAIN_CODE, 'AdComponent', `AdComponent onConnect failed.`);
      return;
    }
    let g1 = new rpc.MessageOption();
    let h1 = rpc.MessageSequence.create();
    await ((t = this.remoteObj) === null || t === void 0 ? void 0 :
    t.sendMessageRequest(CUSTOMIZED_RENDERING, y, h1, g1).then((i1) => {
      hilog.info(HILOG_DOMAIN_CODE, 'AdComponent', `AdComponent sendRequest. result: ${JSON.stringify(i1)}`);
      let j1 = i1.reply.readInt();
      hilog.info(HILOG_DOMAIN_CODE, 'AdComponent', 'AdComponent rpc reply code is : ' + j1);
      if (j1 === -1 || (u === CLOSE && j1 === CODE_SUCCESS)) {
        hilog.warn(HILOG_DOMAIN_CODE, 'AdComponent', `reply code is: ${j1}, event type code is : ${u}.`);
        this.remoteObj = null;
        this.disconnectServiceExtAbility();
      }
    }).catch((j) => {
      hilog.error(HILOG_DOMAIN_CODE, 'AdComponent',
        `AdComponent sendRequest error. code: ${j.code}, message : ${j.message}`);
    }));
  }

  handleUIFail() {
    hilog.info(HILOG_DOMAIN_CODE, 'AdComponent', `AdComponent handleUIFail.`);
    let t;
    (t = this.interactionListener) === null || t === void 0 ? void 0 :
      t.onStatusChanged('onAdFail', this.ads[0], 'UI extension died.');
    this.disconnectServiceExtAbility();
  }

  async registerFailCallback() {
    if (this.remoteObj === null || this.isRegisterFailCallback) {
      hilog.error(HILOG_DOMAIN_CODE, 'AdComponent', `AdComponent registerFailCallback remoteObj is null.`);
      return;
    }
    hilog.info(HILOG_DOMAIN_CODE, 'AdComponent', `registerFailCallback: ${this.connection}`);
    if (!this.failCallbackStub) {
      this.failCallbackStub = new AdFailCallbackStub(this);
    }
    let data = rpc.MessageSequence.create();
    data.writeInterfaceToken(this.remoteObj?.getDescriptor());
    hilog.info(HILOG_DOMAIN_CODE, 'AdComponent', `writeInterfaceToken: ${this.remoteObj?.getDescriptor()}`);
    data.writeInt(REGISTERE);
    hilog.info(HILOG_DOMAIN_CODE, 'AdComponent', `writeInt: ${REGISTERE}`);
    data.writeRemoteObject(this.failCallbackStub);
    let reply = rpc.MessageSequence.create();
    let option = new rpc.MessageOption();
    hilog.info(HILOG_DOMAIN_CODE, 'AdComponent', `registerFailCallback: ${option}`);
    hilog.info(HILOG_DOMAIN_CODE, 'AdComponent', `Attempting to registerFailCallback`);
    await this.remoteObj?.sendMessageRequest(SET_CALLBACK, data, reply, option).then((result) => {
      hilog.info(HILOG_DOMAIN_CODE, 'AdComponent', `AdComponent registerFailCallback result: ${JSON.stringify(result)}`);
      this.isRegisterFailCallback = true;
    }).catch((e) => {
      hilog.error(HILOG_DOMAIN_CODE, 'AdComponent',
        `AdComponent registerFailCallback error. code: ${e.code}, message: ${e.message}`);
    });
  }

  async unregisterFailCallback() {
    hilog.info(HILOG_DOMAIN_CODE, 'AdComponent', `unregisterFailCallback this.isRegisterFailCallback: ${this.isRegisterFailCallback}`);
    if (this.remoteObj === null || !this.isRegisterFailCallback) {
      hilog.error(HILOG_DOMAIN_CODE, 'AdComponent', `AdComponent unregisterFailCallback remoteObj is null.`);
      return;
    }
    hilog.info(HILOG_DOMAIN_CODE, 'AdComponent', `unregisterFailCallback: ${this.connection}`);
    let data = rpc.MessageSequence.create();
    data.writeInterfaceToken(this.remoteObj?.getDescriptor());
    data.writeInt(UNREGISTERE);
    data.writeRemoteObject(this.failCallbackStub);
    let reply = rpc.MessageSequence.create();
    let option = new rpc.MessageOption();
    hilog.info(HILOG_DOMAIN_CODE, 'AdComponent', `unregisterFailCallback: ${option}`);
    hilog.info(HILOG_DOMAIN_CODE, 'AdComponent', `Attempting to unregisterFailCallback`);
    await this.remoteObj?.sendMessageRequest(SET_CALLBACK, data, reply, option).then((result) => {
      hilog.info(HILOG_DOMAIN_CODE, 'AdComponent', `AdComponent unregisterFailCallback result: ${JSON.stringify(result)}`);
    }).catch((e) => {
      hilog.error(HILOG_DOMAIN_CODE, 'AdComponent',
        `AdComponent unregisterFailCallback error. code: ${e.code}, message: ${e.message}`);
    }).finally(() => {
      this.isRegisterFailCallback = false;
      this.failCallbackStub = null;
    });
  }

  aboutToAppear() {
    hilog.info(HILOG_DOMAIN_CODE, 'AdComponent', `AdComponent aboutToAppear.`);
    this.ratios = this.getRatios();
    this.getConfigJsonData();
    this.getSuggestedCompHeight();
    this.registerWindowObserver();
  }

  async aboutToDisappear() {
    hilog.info(HILOG_DOMAIN_CODE, 'AdComponent', `AdComponent aboutToDisappear.`);
    this.unregisterWindowObserver();
    hilog.info(HILOG_DOMAIN_CODE, 'AdComponent', `AdComponent aboutToDisappear connection:${this.connection}`);
    // await this.sendDataRequest(CLOSE, 0);
    await this.unregisterFailCallback();
    this.disconnectServiceExtAbility();
    this.component = null;
  }

  disconnectServiceExtAbility() {
    hilog.info(HILOG_DOMAIN_CODE, 'AdComponent', `AdComponent disconnectServiceExtAbility`);
    if (this.connection === -1) {
      hilog.info(HILOG_DOMAIN_CODE, 'AdComponent', 'already disconnect');
      return;
    }
    this.context.disconnectServiceExtensionAbility(this.connection).then(() => {
      hilog.info(HILOG_DOMAIN_CODE, 'AdComponent', `AdComponent disconnectServiceExtAbility success.`);
    }).catch((f1) => {
      hilog.error(HILOG_DOMAIN_CODE, 'AdComponent',
        `AdComponent disconnectAbility failed. code: ${f1.code}, message : ${f1.message}`);
    }).finally(() => {
      this.remoteObj = null;
      this.connection = -1;
      this.uiExtProxy = null;
      this.isRegisterFailCallback = false;
      this.failCallbackStub = null;
    });
  }

  initAdRender() {
    let t;
    let d1;
    let e1;
    if (((t = this.ads[0]) === null || t === void 0 ? void 0 : t.adType) === 3 &&
      ((d1 = this.ads[0]) === null || d1 === void 0 ? void 0 : d1.creativeType) !== 99 &&
      ((e1 = this.ads[0]) === null || e1 === void 0 ? void 0 : e1.canSelfRendering)) {
      hilog.info(HILOG_DOMAIN_CODE, 'AdComponent', `AdComponent initAdRender self rendering.`);
      this.isAdRenderer = true;
      this.Behavior = HitTestMode.Block;
      this.initIds();
      this.connectServiceExtAbility();
    } else {
      this.showComponent = true;
      this.initIds();
      this.connectServiceExtAbility();
    }
  }

  connectServiceExtAbility() {
    hilog.info(HILOG_DOMAIN_CODE, 'AdComponent', `AdComponent connectServiceExtAbility`);
    if (this.connection !== -1) {
      hilog.info(HILOG_DOMAIN_CODE, 'AdComponent', 'already connect');
      return;
    }
    let a1 = {
      bundleName: this.map.get('providerBundleName'),
      abilityName: this.map.get('providerApiAbilityName'),
    };
    this.connection = this.context.connectServiceExtensionAbility(a1, {
      onConnect: (b1, c1) => {
        let t;
        hilog.info(HILOG_DOMAIN_CODE, 'AdComponent', `AdComponent onConnect success.`);
        if (c1 === null) {
          hilog.info(HILOG_DOMAIN_CODE, 'AdComponent', `AdComponent onConnect remote is null.`);
          return;
        }
        this.remoteObj = c1;
        if (this.isAdRenderer) {
          this.showComponent = true;
          (t = this.interactionListener) === null || t === void 0 ? void 0 :
          t.onStatusChanged('onConnect', this.ads[0], 'onAdRenderer connect api service.');
        } else {
          // this.registerFailCallback();
        }
        if (!this.isRegisterFailCallback) {
          this.registerFailCallback();
        }
      },
      onDisconnect: () => {
        hilog.info(HILOG_DOMAIN_CODE, 'AdComponent', `AdComponent onDisconnect`);
        this.connection = -1;
      },
      onFailed: () => {
        hilog.error(HILOG_DOMAIN_CODE, 'AdComponent', `AdComponent onFailed`);
        this.connection = -1;
      }
    });
    hilog.info(HILOG_DOMAIN_CODE, 'AdComponent', `AdComponent connectServiceExtAbility result: ${this.connection}`);
  }

  Component(x = null) {
    this.observeComponentCreation2((r, s) => {
      UIExtensionComponent.create(this.want);
      UIExtensionComponent.onReceive((y) => {
        let t;
        let z = y;
        if (z.status !== undefined) {
          (t = this.interactionListener) === null || t === void 0 ? void 0 : t.onStatusChanged(z.status, z.ad, z.data);
        }
        if (z.adPageHeight !== undefined) {
          this.uecHeight = z.adPageHeight;
        }
      });
      UIExtensionComponent.onRemoteReady((v) => {
        this.uiExtProxy = v;
        v.on('asyncReceiverRegister', (p) => {
          p.send({
            'type': 'uecOnVisibleData',
            'isVisible': this.isVisibleBeforeRemoteReady,
            'currentRatio': this.currentRatioBeforeRemoteReady,
          });
          p.send({
            'type': 'rollPlayControlData',
            'rollPlayState': this.rollPlayState,
          });
          this.initWindowInfo(p);
        });
      });
      UIExtensionComponent.onVisibleAreaChange(this.ratios, (v, r) => {
        if (this.uiExtProxy) {
          this.uiExtProxy.send({
            'type': 'uecOnVisibleData',
            'isVisible': v,
            'currentRatio': r,
          });
        } else {
          this.isVisibleBeforeRemoteReady = v;
          this.currentRatioBeforeRemoteReady = r;
        }
      });
      UIExtensionComponent.width('100%');
      UIExtensionComponent.height(this.uecHeight);
    }, UIExtensionComponent);
  }

  onAreaClick() {
    let t;
    const type = this.displayOptions?.type;
    if (this.isAdRenderer && (!type || type === 'isClickable')) {
      hilog.info(HILOG_DOMAIN_CODE, 'AdComponent', 'AdComponent onClick');
      const u = CLICK;
      this.sendDataRequest(u);
      (t = this.interactionListener) === null || t === void 0 ? void 0 :
        t.onStatusChanged('onAdClick', this.ads[0], 'onAdRenderer click');
    }
  }

  onColumnStateChange() {
    Column.create();
    Column.width('100%');
    Column.hitTestBehavior(this.Behavior);
    Column.onVisibleAreaChange(this.ratios, (v, w) => {
      const type = this.displayOptions?.type;
      if (this.isAdRenderer && (!type || type === 'main')) {
        hilog.info(HILOG_DOMAIN_CODE, 'AdComponent', `AdComponent isVisible is :${v}, currentRatio is :${w}`);
        const u = IMP;
        this.sendDataRequest(u, w);
      }
    });
    Column.onClick(() => this.onAreaClick());
  }

  updateView() {
    this.ifElseBranchUpdateFunction(0, () => {
      this.observeComponentCreation2((r, s) => this.onColumnStateChange(), Column);
      this.adRenderer.bind(this)();
      Column.pop();
    });
  }

  initialRender() {
    this.observeComponentCreation2((r, s) => {
      Row.create();
      Row.height(this.uecHeight);
    }, Row);
    this.observeComponentCreation2((r, s) => {
      If.create();
      if (this.showComponent) {
        this.updateView();
      } else {
        this.ifElseBranchUpdateFunction(1, () => {
        });
      }
    }, If);
    If.pop();
    Row.pop();
  }

  getConfigPath() {
    let i = '';
    i = configPolicy.getOneCfgFileSync('etc/advertising/ads_framework/ad_service_config_ext.json');
    if (i === null || i === '') {
      hilog.warn(HILOG_DOMAIN_CODE, 'AdComponent', 'get ext config fail');
      i = configPolicy.getOneCfgFileSync('etc/advertising/ads_framework/ad_service_config.json');
    }
    if (i === null || i === '') {
      hilog.warn(HILOG_DOMAIN_CODE, 'AdComponent', 'get config fail');
      this.setWant();
      return '';
    }
    return i;
  }

  getConfigJsonData() {
    const i = this.getConfigPath();
    if (i === '') {
      return;
    }
    try {
      const k = fs.openSync(i);
      const l = new ArrayBuffer(READ_FILE_BUFFER_SIZE);
      let m = fs.readSync(k.fd, l);
      fs.closeSync(k);
      let n = String.fromCharCode(...new Uint8Array(l.slice(0, m)));
      const b = new RegExp('\[\\r\\n\\t\\\"\]', 'g');
      const o = new RegExp('\\s*', 'g');
      const p = new RegExp('\\\[\|\\\]', 'g');
      n = n.replace(b, '').replace(o, '').replace(p, '');
      this.toMap(n);
      hilog.info(HILOG_DOMAIN_CODE, 'AdComponent', `file succeed`);
      if (!this.map) {
        hilog.info(HILOG_DOMAIN_CODE, 'AdComponent', `get config json failed`);
      }
      this.setWant();
    } catch (j) {
      hilog.error(HILOG_DOMAIN_CODE, 'AdComponent', `open file failed with error:${j.code}, message:${j.message}`);
      this.setWant();
    }
  }

  getSuggestedCompHeight() {
    try {
      if (this.ads[0].suggestedCompHeight !== undefined) {
        this.uecHeight = this.ads[0].suggestedCompHeight;
      }
    } catch (e) {
      hilog.error(HILOG_DOMAIN_CODE, 'AdComponent', `Get suggestedHeight error, code: ${e.code}, msg: ${e.message}`);
    }
  }

  initWindowInfo(proxy) {
    try {
      const win = this.context.windowStage.getMainWindowSync();
      proxy?.send({
        'type': 'windowStatusChange',
        'windowStatusType': win.getWindowStatus(),
      });
    } catch (e) {
      hilog.error(HILOG_DOMAIN_CODE, 'AdComponent', `Failed to obtain window status. Code is ${e?.code}, message is ${e?.message}`);
    }
  }

  registerWindowObserver() {
    try {
      const win = this.context.windowStage.getMainWindowSync();
      win.on('windowStatusChange', (windowStatusType) => {
        this.uiExtProxy?.send({
          'type': 'windowStatusChange',
          'windowStatusType': windowStatusType,
        });
      });
    } catch (e) {
      hilog.error(HILOG_DOMAIN_CODE, 'AdComponent', `Failed to observe windowStatusChange. Code is ${e?.code}, message is ${e?.message}`);
    }
  }

  unregisterWindowObserver() {
    try {
      const win = this.context.windowStage.getMainWindowSync();
      win.off('windowStatusChange');
    } catch (e) {
      hilog.error(HILOG_DOMAIN_CODE, 'AdComponent', `Failed to off observe windowStatusChange. Code is ${e?.code}, message is ${e?.message}`);
    }
  }

  setWant() {
    hilog.info(HILOG_DOMAIN_CODE, 'AdComponent', `setWant map ${this.map.toString()}`);
    hilog.info(HILOG_DOMAIN_CODE, 'AdComponent', `setWant map displayOptions:${JSON.stringify(this.displayOptions.toString())}`);
    hilog.info(HILOG_DOMAIN_CODE, 'AdComponent', `setWant map displayOptions:${JSON.stringify(this.displayOptions)}`);
    hilog.info(HILOG_DOMAIN_CODE, 'AdComponent', `setWant map this.uniqueId:${this.uniqueId}`);
    if (this.map) {
      this.want = {
        bundleName: this.map.get('providerBundleName'),
        abilityName: this.map.get('providerUEAAbilityName'),
        parameters: {
          ads: this.ads,
          displayOptions: this.displayOptions,
          'ability.want.params.uiExtensionType': 'ads'
        }
      };
    }
    this.initAdRender();
  }

  toMap(a) {
    const b = new RegExp('\[\{\}\]', 'g');
    a = a.replace(b, '');
    const c = a.split(',');
    for (let d = 0; d < c.length; d++) {
      const e = c[d];
      const f = e.indexOf(':');
      if (f > -1) {
        const g = e.substring(0, f);
        const h = e.substring(f + 1);
        this.map.set(g, h);
      }
    }
  }

  rerender() {
    this.updateDirtyElements();
  }
}

export default {
  AdComponent
};