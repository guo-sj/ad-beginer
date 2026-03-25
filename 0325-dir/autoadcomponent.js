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

let advertising = globalThis.requireNapi('advertising');

let fs = globalThis.requireNapi('file.fs');

let hilog = globalThis.requireNapi('hilog');

let configPolicy = globalThis.requireNapi('configPolicy');

let rpc = globalThis.requireNapi('rpc');

let util = globalThis.requireNapi('util');

const MAX_REFRESH_TIME = 12e4;

const MIN_REFRESH_TIME = 3e4;

const HILOG_DOMAIN_CODE = 65280;
const READ_FILE_BUFFER_SIZE = 4096;
const SHOW_START = 0;
const IMP = 1;
const CLICK = 2;
const CUSTOMIZED_RENDERING = 3;
const SET_CALLBACK = 6;
const REGISTERE = 1;
const UNREGISTERE = 0;

class AutoAdFailCallbackStub extends rpc.RemoteObject {
  constructor(component) {
    super('AdFailCallbackDescriptor');
    this.component = component;
  }

  onRemoteMessageRequest(code, data, reply, options) {
    this.component.handleUIFail();
    return true;
  }
}

class AutoAdComponent extends ViewPU {
  constructor(t, o, i, e = -1) {
    super(t, i, e);
    this.context = getContext(this);
    this.want = void 0;
    this.__showComponent = new ObservedPropertySimplePU(!1, this, 'showComponent');
    this.timeoutId = void 0;
    this.refreshTime = void 0;
    this.loader = void 0;
    this.isAutoRefresh = void 0;
    this.remoteProxy = void 0;
    this.adParam = void 0;
    this.adOptions = void 0;
    this.displayOptions = void 0;
    this.interactionListener = void 0;
    this.ads = void 0;
    this.isFirstLoad = !0;
    this.isTaskRunning = !1;
    this.isVisibleBeforeRemoteReady = false;
    this.currentRatioBeforeRemoteReady = 0;
    this.connection = -1;
    this.remoteObj = null;
    this.failCallbackStub = null;
    this.isRegisterFailCallback = false;
    this.eventUniqueId = '';
    this.uniqueId = '';
    this.configMap = null;
    this.isAdRenderer = false;
    this.adRenderer = this.createUIExtensionComponent;
    this.setInitiallyProvidedValue(o);
  }

  setInitiallyProvidedValue(t) {
    void 0 !== t.context && (this.context = t.context);
    void 0 !== t.want && (this.want = t.want);
    void 0 !== t.showComponent && (this.showComponent = t.showComponent);
    void 0 !== t.timeoutId && (this.timeoutId = t.timeoutId);
    void 0 !== t.refreshTime && (this.refreshTime = t.refreshTime);
    void 0 !== t.loader && (this.loader = t.loader);
    void 0 !== t.isAutoRefresh && (this.isAutoRefresh = t.isAutoRefresh);
    void 0 !== t.remoteProxy && (this.remoteProxy = t.remoteProxy);
    void 0 !== t.adParam && (this.adParam = t.adParam);
    void 0 !== t.adOptions && (this.adOptions = t.adOptions);
    void 0 !== t.displayOptions && (this.displayOptions = t.displayOptions);
    void 0 !== t.interactionListener && (this.interactionListener = t.interactionListener);
    void 0 !== t.ads && (this.ads = t.ads);
    void 0 !== t.isFirstLoad && (this.isFirstLoad = t.isFirstLoad);
    void 0 !== t.isTaskRunning && (this.isTaskRunning = t.isTaskRunning);
    void 0 !== t.adRenderer && (this.adRenderer = t.adRenderer);
  }

  updateStateVars(t) {
  }

  purgeVariableDependenciesOnElmtId(t) {
    this.__showComponent.purgeDependencyOnElmtId(t);
  }

  aboutToBeDeleted() {
    this.__showComponent.aboutToBeDeleted();
    SubscriberManager.Get().delete(this.id__());
    this.aboutToBeDeletedInternal();
  }

  get showComponent() {
    return this.__showComponent.get();
  }

  set showComponent(t) {
    this.__showComponent.set(t);
  }

  toMap(t) {
    const o = (t = t.replace(/[{}]/g, '')).split(',');
    const i = {};
    for (let t = 0; t < o.length; t++) {
      const e = o[t];
      const s = e.indexOf(':');
      if (s > -1) {
        const t = e.substring(0, s);
        const o = e.substring(s + 1);
        i[t] = o;
      }
    }
    return i;
  }

  getConfigJsonData() {
    let t = null;
    let i = null;
    i = configPolicy.getOneCfgFileSync('etc/advertising/ads_framework/ad_service_config_ext.json');
    if (i === null || i === '') {
      hilog.warn(HILOG_DOMAIN_CODE, 'AutoAdComponent', 'get ext config fail');
      i = configPolicy.getOneCfgFileSync('etc/advertising/ads_framework/ad_service_config.json');
      if (i === null || i === '') {
        hilog.warn(HILOG_DOMAIN_CODE, 'AutoAdComponent', 'get config fail');
        this.setWant(t);
        return;
      }
    }
    hilog.info(HILOG_DOMAIN_CODE, 'AutoAdComponent', 'value is ' + i);
    try {
      const o = fs.openSync(i);
      const e = new ArrayBuffer(READ_FILE_BUFFER_SIZE);
      let s = fs.readSync(o.fd, e);
      fs.closeSync(o);
      let n = String.fromCharCode(...new Uint8Array(e.slice(0, s)));
      n = n.replace(/[\r\n\t\"]/g, '').replace(/\s*/g, '').replace(/\[|\]/g, '');
      t = this.toMap(n);
      hilog.info(HILOG_DOMAIN_CODE, 'AutoAdComponent', 'file succeed');
      t || hilog.info(HILOG_DOMAIN_CODE, 'AutoAdComponent', 'get config json failed');
      this.setWant(t);
    } catch (o) {
      hilog.error(HILOG_DOMAIN_CODE, 'AutoAdComponent',
        `open file failed with error:${o.code}, message:${o.message}`);
      this.setWant(t);
    }
  }

  setWant(t) {
    hilog.info(HILOG_DOMAIN_CODE, 'AutoAdComponent', `setWant map ${t}`);
    if (t) {
      this.configMap = t;
      this.want = {
        bundleName: t.providerBundleName,
        abilityName: t.providerUEAAbilityName,
        parameters: {
          ads: this.ads,
          displayOptions: this.displayOptions,
          'ability.want.params.uiExtensionType': 'ads'
        }
      };
      this.isAdRenderer = this.ads?.[0]?.adType === 3 &&
        this.ads?.[0]?.creativeType !== 99 &&
        this.ads?.[0]?.canSelfRendering;
      this.initIds();
      this.connectServiceExtAbility();
    }
  }

  initIds() {
    this.eventUniqueId = util.generateRandomUUID(true);
    this.uniqueId = this.ads?.[0]?.uniqueId;
  }

  getMillis() {
    return Date.now().toString();
  }

  createRpcData(u, w) {
    let data = rpc.MessageSequence.create();
    data.writeInterfaceToken(this.remoteObj?.getDescriptor());
    data.writeInt(u);
    data.writeString(this.eventUniqueId);
    data.writeString(this.uniqueId);
    if (w !== null && w !== undefined) {
      data.writeString(this.getMillis());
      data.writeFloat(w);
    }
    return data;
  }

  async sendDataRequest(u, w) {
    if (this.remoteObj === null) {
      hilog.error(HILOG_DOMAIN_CODE, 'AutoAdComponent', 'AutoAdComponent remoteObj is null.');
      return;
    }
    const data = this.createRpcData(u, w);
    let reply = rpc.MessageSequence.create();
    let option = new rpc.MessageOption();
    await this.remoteObj.sendMessageRequest(CUSTOMIZED_RENDERING, data, reply, option).then((result) => {
      hilog.info(HILOG_DOMAIN_CODE, 'AutoAdComponent', `AutoAdComponent sendRequest result: ${JSON.stringify(result)}`);
      let code = result.reply.readInt();
      hilog.info(HILOG_DOMAIN_CODE, 'AutoAdComponent', `AutoAdComponent rpc reply code: ${code}`);
      if (code === -1) {
        this.disconnectServiceExtAbility();
      }
    }).catch((e) => {
      hilog.error(HILOG_DOMAIN_CODE, 'AutoAdComponent',
        `AutoAdComponent sendRequest error. code: ${e.code}, message: ${e.message}`);
    });
  }

  connectServiceExtAbility() {
    hilog.info(HILOG_DOMAIN_CODE, 'AutoAdComponent', 'AutoAdComponent connectServiceExtAbility');
    if (this.connection !== -1) {
      hilog.info(HILOG_DOMAIN_CODE, 'AutoAdComponent', 'already connect');
      return;
    }
    if (!this.configMap) {
      hilog.error(HILOG_DOMAIN_CODE, 'AutoAdComponent', 'AutoAdComponent connectServiceExtAbility configMap is null');
      return;
    }
    const want = {
      bundleName: this.configMap.providerBundleName,
      abilityName: this.configMap.providerApiAbilityName,
    };
    this.connection = this.context.connectServiceExtensionAbility(want, {
      onConnect: (elementName, remoteObj) => {
        hilog.info(HILOG_DOMAIN_CODE, 'AutoAdComponent', 'AutoAdComponent onConnect success.');
        if (remoteObj === null) {
          hilog.error(HILOG_DOMAIN_CODE, 'AutoAdComponent', 'AutoAdComponent onConnect remote is null.');
          return;
        }
        this.remoteObj = remoteObj;
        if (this.isAdRenderer) {
          this.sendDataRequest(SHOW_START);
        }
        if (!this.isRegisterFailCallback) {
          this.registerFailCallback();
        }
      },
      onDisconnect: () => {
        hilog.info(HILOG_DOMAIN_CODE, 'AutoAdComponent', 'AutoAdComponent onDisconnect');
        this.connection = -1;
      },
      onFailed: () => {
        hilog.error(HILOG_DOMAIN_CODE, 'AutoAdComponent', 'AutoAdComponent onFailed');
        this.connection = -1;
      }
    });
    hilog.info(HILOG_DOMAIN_CODE, 'AutoAdComponent', `AutoAdComponent connectServiceExtAbility result: ${this.connection}`);
  }

  disconnectServiceExtAbility() {
    hilog.info(HILOG_DOMAIN_CODE, 'AutoAdComponent', 'AutoAdComponent disconnectServiceExtAbility');
    if (this.connection === -1) {
      hilog.info(HILOG_DOMAIN_CODE, 'AutoAdComponent', 'already disconnect');
      return;
    }
    this.context.disconnectServiceExtensionAbility(this.connection).then(() => {
      hilog.info(HILOG_DOMAIN_CODE, 'AutoAdComponent', 'AutoAdComponent disconnectServiceExtAbility success.');
    }).catch((e) => {
      hilog.error(HILOG_DOMAIN_CODE, 'AutoAdComponent',
        `AutoAdComponent disconnectAbility failed. code: ${e.code}, message: ${e.message}`);
    }).finally(() => {
      this.remoteObj = null;
      this.connection = -1;
      this.isRegisterFailCallback = false;
      this.failCallbackStub = null;
    });
  }

  handleUIFail() {
    hilog.info(HILOG_DOMAIN_CODE, 'AutoAdComponent', 'AutoAdComponent handleUIFail.');
    this.interactionListener?.onStatusChanged('onAdFail', this.ads?.[0], 'UI extension died.');
    this.disconnectServiceExtAbility();
  }

  async registerFailCallback() {
    if (this.remoteObj === null || this.isRegisterFailCallback) {
      hilog.error(HILOG_DOMAIN_CODE, 'AutoAdComponent', 'AutoAdComponent registerFailCallback remoteObj is null.');
      return;
    }
    hilog.info(HILOG_DOMAIN_CODE, 'AutoAdComponent', `AutoAdComponent registerFailCallback: ${this.connection}`);
    if (!this.failCallbackStub) {
      this.failCallbackStub = new AutoAdFailCallbackStub(this);
    }
    let data = rpc.MessageSequence.create();
    data.writeInterfaceToken(this.remoteObj?.getDescriptor());
    data.writeInt(REGISTERE);
    data.writeRemoteObject(this.failCallbackStub);
    let reply = rpc.MessageSequence.create();
    let option = new rpc.MessageOption();
    await this.remoteObj?.sendMessageRequest(SET_CALLBACK, data, reply, option).then((result) => {
      hilog.info(HILOG_DOMAIN_CODE, 'AutoAdComponent', `AutoAdComponent registerFailCallback result: ${JSON.stringify(result)}`);
      this.isRegisterFailCallback = true;
    }).catch((e) => {
      hilog.error(HILOG_DOMAIN_CODE, 'AutoAdComponent',
        `AutoAdComponent registerFailCallback error. code: ${e.code}, message: ${e.message}`);
    });
  }

  async unregisterFailCallback() {
    hilog.info(HILOG_DOMAIN_CODE, 'AutoAdComponent', `AutoAdComponent unregisterFailCallback isRegisterFailCallback: ${this.isRegisterFailCallback}`);
    if (this.remoteObj === null || !this.isRegisterFailCallback) {
      hilog.error(HILOG_DOMAIN_CODE, 'AutoAdComponent', 'AutoAdComponent unregisterFailCallback remoteObj is null.');
      return;
    }
    let data = rpc.MessageSequence.create();
    data.writeInterfaceToken(this.remoteObj?.getDescriptor());
    data.writeInt(UNREGISTERE);
    data.writeRemoteObject(this.failCallbackStub);
    let reply = rpc.MessageSequence.create();
    let option = new rpc.MessageOption();
    await this.remoteObj?.sendMessageRequest(SET_CALLBACK, data, reply, option).then((result) => {
      hilog.info(HILOG_DOMAIN_CODE, 'AutoAdComponent', `AutoAdComponent unregisterFailCallback result: ${JSON.stringify(result)}`);
    }).catch((e) => {
      hilog.error(HILOG_DOMAIN_CODE, 'AutoAdComponent',
        `AutoAdComponent unregisterFailCallback error. code: ${e.code}, message: ${e.message}`);
    }).finally(() => {
      this.isRegisterFailCallback = false;
      this.failCallbackStub = null;
    });
  }

  loadAd() {
    hilog.info(HILOG_DOMAIN_CODE, 'AutoAdComponent', 'start load advertising.');
    const ad = {
      adType: this.adParam?.adType,
      uniqueId: '',
      rewarded: false,
      shown: false,
      clicked: false,
      rewardVerifyConfig: new Map()
    };
    let t = {
      onAdLoadFailure: (t, o) => {
        this.interactionListener.onStatusChanged('onAdFail', ad, t?.toString());
      },
      onAdLoadSuccess: t => {
        hilog.info(HILOG_DOMAIN_CODE, 'AutoAdComponent', 'request ad success!');
        hilog.info(HILOG_DOMAIN_CODE, 'AutoAdComponent', `adArray is : ${JSON.stringify(t)}`);
        if (t[0]) {
          ad.uniqueId = t[0].uniqueId;
          ad.adType = t[0].adType;
          ad.rewardVerifyConfig = t[0].rewardVerifyConfig;
        }
        this.interactionListener.onStatusChanged('onAdLoad', ad, '');
        if (this.isFirstLoad) {
          this.ads = t;
          this.showComponent = !0;
          this.isFirstLoad = !1;
          this.getConfigJsonData();
        } else if (this.isTaskRunning) {
          hilog.info(HILOG_DOMAIN_CODE, 'AutoAdComponent', 'send data.');
          this.remoteProxy.send({
            ads: t
          });
        }
      }
    };
    this.loader.loadAd(this.adParam, this.adOptions, t);
    this.refreshAd();
  }

  initRefreshTime() {
    if (!(this.displayOptions && this.displayOptions.refreshTime &&
      typeof this.displayOptions.refreshTime === 'number' && this.displayOptions.refreshTime > 0)) {
      hilog.info(HILOG_DOMAIN_CODE, 'AutoAdComponent', `Invalid input refreshTime, refreshTime is: ${this.refreshTime}.`);
      return !1;
    }
    this.displayOptions.refreshTime < MIN_REFRESH_TIME ? this.refreshTime = MIN_REFRESH_TIME :
      this.displayOptions.refreshTime > MAX_REFRESH_TIME ? this.refreshTime = MAX_REFRESH_TIME :
        this.refreshTime = this.displayOptions.refreshTime;
    hilog.info(HILOG_DOMAIN_CODE, 'AutoAdComponent', `refreshTime is: ${this.refreshTime} ms.`);
    return !0;
  }

  async refreshAd() {
    if (this.isAutoRefresh) {
      hilog.info(HILOG_DOMAIN_CODE, 'AutoAdComponent', 'start next task.');
      this.isTaskRunning = !0;
      this.timeoutId = setTimeout((() => {
        hilog.info(HILOG_DOMAIN_CODE, 'AutoAdComponent', `run task, timeoutId:${this.timeoutId}.`);
        this.loadAd();
      }), this.refreshTime);
      hilog.info(HILOG_DOMAIN_CODE, 'AutoAdComponent', `start next task timeoutId:${this.timeoutId}.`);
    }
  }

  aboutToAppear() {
    hilog.info(HILOG_DOMAIN_CODE, 'AutoAdComponent', 'aboutToAppear.');
    hilog.info(HILOG_DOMAIN_CODE, 'AutoAdComponent', `displayOptions:${JSON.stringify(this.displayOptions)}.`);
    this.loader = new advertising.AdLoader(this.context);
    this.isAutoRefresh = this.initRefreshTime();
    this.loadAd();
  }

  async aboutToDisappear() {
    hilog.info(HILOG_DOMAIN_CODE, 'AutoAdComponent', 'aboutToDisappear.');
    hilog.info(HILOG_DOMAIN_CODE, 'AutoAdComponent', `timeoutId is: ${this.timeoutId}.`);
    if (null != this.timeoutId) {
      hilog.info(HILOG_DOMAIN_CODE, 'AutoAdComponent', `stop refresh task, timeoutId:${this.timeoutId}.`);
      clearTimeout(this.timeoutId);
      this.isTaskRunning = !1;
    }
    await this.unregisterFailCallback();
    this.disconnectServiceExtAbility();
  }

  onAreaClick() {
    const type = this.displayOptions?.type;
    if (this.isAdRenderer && (!type || type === 'isClickable')) {
      hilog.info(HILOG_DOMAIN_CODE, 'AutoAdComponent', 'AutoAdComponent onClick');
      this.sendDataRequest(CLICK);
      this.interactionListener?.onStatusChanged('onAdClick', this.ads?.[0], 'onAdClick');
    }
  }

  createUIExtensionComponent(t, o) {
    UIExtensionComponent.create(this.want);
    UIExtensionComponent.width('100%');
    UIExtensionComponent.height('100%');
    UIExtensionComponent.onRemoteReady((t => {
      this.remoteProxy = t;
      hilog.info(HILOG_DOMAIN_CODE, 'AutoAdComponent', 'remote proxy ready.');
      t.on('asyncReceiverRegister', (p) => {
        p.send({
          'type': 'uecOnVisibleData',
          'isVisible': this.isVisibleBeforeRemoteReady,
          'currentRatio': this.currentRatioBeforeRemoteReady,
        });
      });
    }));
    UIExtensionComponent.onVisibleAreaChange([0, 1], (v, r) => {
      if (this.remoteProxy) {
        this.remoteProxy.send({
          'type': 'uecOnVisibleData',
          'isVisible': v,
          'currentRatio': r,
        });
      } else {
        this.isVisibleBeforeRemoteReady = v;
        this.currentRatioBeforeRemoteReady = r;
      }
    });
    UIExtensionComponent.onReceive((t => {
      try {
        hilog.info(HILOG_DOMAIN_CODE, 'AutoAdComponent', `${JSON.stringify(t)}`);
      } catch (o) {
        hilog.error(HILOG_DOMAIN_CODE, 'AutoAdComponent',
        `onReceive print data error, code: ${o.code}, message: ${o.message}`);
      }
      if (t.status !== undefined) {
        this.interactionListener.onStatusChanged(t.status, t.ad, t.data);
      }
    }));
    o || UIExtensionComponent.pop();
  }

  updateView() {
    this.ifElseBranchUpdateFunction(0, (() => {
      this.observeComponentCreation(((t, o) => {
        ViewStackProcessor.StartGetAccessRecordingFor(t);
        this.adRenderer.bind(this)(t, o);
        ViewStackProcessor.StopGetAccessRecording();
      }));
    }));
  }

  initialRender() {
    this.observeComponentCreation(((t, o) => {
      ViewStackProcessor.StartGetAccessRecordingFor(t);
      Row.create();
      Row.height('100%');
      Row.onVisibleAreaChange([0, 1], ((t, o) => {
        this.visibleAreaChange(t, o);
      }));
      o || Row.pop();
      ViewStackProcessor.StopGetAccessRecording();
    }));
    this.observeComponentCreation(((t, o) => {
      ViewStackProcessor.StartGetAccessRecordingFor(t);
      Column.create();
      Column.width('100%');
      Column.onClick(() => this.onAreaClick());
      o || Column.pop();
      ViewStackProcessor.StopGetAccessRecording();
    }));
    this.observeComponentCreation(((t, o) => {
      ViewStackProcessor.StartGetAccessRecordingFor(t);
      If.create();
      this.showComponent ? this.updateView() : If.branchId(1);
      o || If.pop();
      ViewStackProcessor.StopGetAccessRecording();
    }));
    If.pop();
    Column.pop();
    Row.pop();
  }

  visibleAreaChange(t, o) {
    hilog.info(HILOG_DOMAIN_CODE, 'AutoAdComponent', `isVisible:${t}, currentRatio:${o}`);
    if (t && o >= 0.9) {
      hilog.info(HILOG_DOMAIN_CODE, 'AutoAdComponent', 'component visible');
      this.isTaskRunning || this.refreshAd();
      if (this.isAdRenderer) {
        const type = this.displayOptions?.type;
        if (!type || type === 'main') {
          this.sendDataRequest(IMP, o);
        }
      }
    }
    if (!t && o <= 0) {
      hilog.info(HILOG_DOMAIN_CODE, 'AutoAdComponent', 'component invisible');
      hilog.info(HILOG_DOMAIN_CODE, 'AutoAdComponent', `stop task, timeoutId:${this.timeoutId}.`);
      clearTimeout(this.timeoutId);
      this.isTaskRunning = !1;
    }
  }

  rerender() {
    this.updateDirtyElements();
  }
}

export default { AutoAdComponent };
