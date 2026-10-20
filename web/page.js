(() => {
  const runtime = window.OneKVMPluginUI.v1
  const inToolbox = new URL(document.currentScript.src).pathname.endsWith('/tool.js')
  const { computed, defineComponent, h, onBeforeUnmount, ref } = runtime.vue
  const { NAlert, NButton, NInput, NModal, useMessage } = runtime.naive
  const macPattern = /^(?:[0-9a-fA-F]{2}[:-]){5}[0-9a-fA-F]{2}$/
  const labels = runtime.i18n.createMessages({
    'zh-TW': { description: '向區域網路內的裝置傳送喚醒封包。', listTitle: '已儲存裝置', oneTimeTitle: '臨時喚醒', label: '裝置名稱', labelPlaceholder: '例如：辦公室電腦', mac: 'MAC 位址', macPlaceholder: '00:11:22:33:44:55', invalid: 'MAC 位址格式不正確。', duplicate: 'MAC 位址不能重複。', tooLarge: '裝置清單超過 4 KiB，請縮短標籤或刪除部分裝置。', add: '新增裝置', remove: '刪除', edit: '編輯', editTitle: '編輯裝置', save: '儲存', saveError: '儲存失敗，請重試。', wake: '喚醒', wakeOnce: '傳送喚醒', success: '喚醒封包已傳送。', empty: '尚未儲存裝置', emptyHint: '新增常用裝置，下次一鍵喚醒。', cancel: '取消', networkHint: '目標裝置需啟用網路喚醒，並與 OneKVM 位於同一區域網路。' },
    zh: { description: '向局域网内的设备发送唤醒包。', listTitle: '已保存设备', oneTimeTitle: '临时唤醒', label: '设备名称', labelPlaceholder: '例如：办公室电脑', mac: 'MAC 地址', macPlaceholder: '00:11:22:33:44:55', invalid: 'MAC 地址格式不正确。', duplicate: 'MAC 地址不能重复。', tooLarge: '设备列表超过 4 KiB，请缩短标签或删除部分设备。', add: '添加设备', remove: '删除', edit: '编辑', editTitle: '编辑设备', save: '保存', saveError: '保存失败，请重试。', wake: '唤醒', wakeOnce: '发送唤醒', success: '唤醒包已发送。', empty: '还没有保存设备', emptyHint: '添加常用设备，下次一键唤醒。', cancel: '取消', networkHint: '目标设备需开启网络唤醒，并与 OneKVM 位于同一局域网。' },
    en: { description: 'Send wake packets to devices on your local network.', listTitle: 'Saved devices', oneTimeTitle: 'Quick wake', label: 'Device name', labelPlaceholder: 'For example: Office PC', mac: 'MAC address', macPlaceholder: '00:11:22:33:44:55', invalid: 'Use a valid MAC address.', duplicate: 'MAC addresses must be unique.', tooLarge: 'The device list exceeds 4 KiB. Shorten labels or remove some devices.', add: 'Add device', remove: 'Remove', edit: 'Edit', editTitle: 'Edit device', save: 'Save', saveError: 'Could not save. Please try again.', wake: 'Wake', wakeOnce: 'Send wake', success: 'Wake packet sent.', empty: 'No saved devices yet', emptyHint: 'Add a device to wake it with one click next time.', cancel: 'Cancel', networkHint: 'Enable Wake on LAN on the target device and connect it to the same local network as OneKVM.' },
  })

  function normalizeMAC(value) {
    return String(value || '').trim().replaceAll('-', ':').toLowerCase()
  }

  function parseDevices(value) {
    try {
      const parsed = JSON.parse(typeof value === 'string' ? value : '[]')
      if (!Array.isArray(parsed)) return []
      return parsed.slice(0, 32).map((item, index) => ({
        id: `${Date.now()}-${index}-${Math.random()}`,
        label: typeof item?.label === 'string' ? item.label.slice(0, 64) : '',
        mac: typeof item?.mac === 'string' ? normalizeMAC(item.mac).slice(0, 17) : '',
      }))
    } catch (_) {
      return []
    }
  }

  function serialized(devices) {
    return JSON.stringify(devices.map(({ label, mac }) => ({ label: label.trim(), mac: normalizeMAC(mac) })))
  }

  const SettingsWindow = defineComponent({
    inheritAttrs: false,
    props: ['open', 'title'],
    emits: ['close'],
    setup(props, { slots, emit }) {
      return () => h(NModal, {
        show: props.open, preset: 'card', title: props.title,
        class: 'wol-settings-dialog', maskClosable: false,
        style: { width: 'min(440px, calc(100vw - 32px))', maxHeight: 'calc(100dvh - 32px)', overflow: 'auto' },
        'onUpdate:show': show => { if (!show) emit('close') },
      }, { default: () => slots.default?.() })
    },
  })
  const EditorWindow = inToolbox ? runtime.toolbox.Window : SettingsWindow
  const DeviceForm = defineComponent({
    props: ['draft', 'error', 'macError', 'valid', 'saving'],
    emits: ['update:label', 'update:mac', 'submit', 'cancel', 'remove'],
    setup(props, { emit }) {
      return () => h('form', { class: 'wol-device-form', onSubmit: event => { event.preventDefault(); emit('submit') } }, [
        props.error ? h(NAlert, { type: 'error', showIcon: false }, { default: () => props.error }) : null,
        h('label', { class: 'wol-field' }, [
          h('span', labels.label),
          h(NInput, {
            inputProps: { 'aria-label': labels.label }, value: props.draft.label,
            maxlength: 64, placeholder: labels.labelPlaceholder, disabled: props.saving,
            'onUpdate:value': value => emit('update:label', value),
          }),
        ]),
        h('label', { class: 'wol-field' }, [
          h('span', labels.mac),
          h(NInput, {
            class: 'wol-mac-input', inputProps: { 'aria-label': labels.mac, spellcheck: false },
            value: props.draft.mac, maxlength: 17, placeholder: labels.macPlaceholder,
            status: props.macError ? 'error' : undefined, disabled: props.saving,
            'onUpdate:value': value => emit('update:mac', value),
            onBlur: () => emit('update:mac', normalizeMAC(props.draft.mac)),
          }),
          props.macError ? h('small', { class: 'wol-field-message wol-error', role: 'alert' }, props.macError) : null,
        ]),
        h('div', { class: 'wol-editor-actions' }, [
          props.draft.id ? h(NButton, { quaternary: true, type: 'error', disabled: props.saving, onClick: () => emit('remove') }, { default: () => labels.remove }) : h('span'),
          h('div', { class: 'wol-device-actions' }, [
            h(NButton, { secondary: true, disabled: props.saving, onClick: () => emit('cancel') }, { default: () => labels.cancel }),
            h(NButton, { type: 'primary', attrType: 'submit', loading: props.saving, disabled: !props.valid || props.saving }, { default: () => labels.save }),
          ]),
        ]),
      ])
    },
  })

  const Page = defineComponent({
    name: 'WakeOnLANPage',
    props: { host: { type: Object, required: true } },
    setup(props) {
      const devices = ref(parseDevices(props.host.extension.value.settings.devices_json))
      const saved = ref(serialized(devices.value))
      const pending = ref(null)
      const draft = ref(null)
      const savingList = ref(false)
      const oneTimeMac = ref('')
      const busy = ref('')
      const error = ref('')
      const editorError = ref('')
      const message = useMessage()
      const nextDevices = computed(() => {
        if (!draft.value) return devices.value
        const item = { ...draft.value, id: draft.value.id || 'new' }
        return draft.value.id ? devices.value.map(device => device.id === item.id ? item : device) : [...devices.value, item]
      })
      function listValid(items) {
        const macs = items.map(item => normalizeMAC(item.mac))
        return items.length <= 32 && new Set(macs).size === macs.length &&
          new TextEncoder().encode(serialized(items)).byteLength <= 4096 &&
          items.every(item => item.label.trim().length > 0 && item.label.trim().length <= 64 && macPattern.test(normalizeMAC(item.mac)))
      }
      const macError = computed(() => {
        const mac = normalizeMAC(draft.value?.mac)
        if (!mac) return ''
        if (devices.value.some(item => item.id !== draft.value.id && normalizeMAC(item.mac) === mac)) return labels.duplicate
        return macPattern.test(mac) ? '' : labels.invalid
      })
      const tooLarge = computed(() => new TextEncoder().encode(serialized(nextDevices.value)).byteLength > 4096)
      const draftValid = computed(() => Boolean(draft.value) && listValid(nextDevices.value))
      const valid = computed(() => listValid(pending.value || devices.value))
      const dirty = computed(() => pending.value !== null && serialized(pending.value) !== saved.value)
      const unregister = props.host.registerSettings({
        dirty, valid, showHostActions: false,
        collect: () => ({ devices_json: serialized(pending.value || devices.value) }),
        reset: settings => {
          devices.value = parseDevices(settings.devices_json)
          saved.value = serialized(devices.value)
          error.value = ''
        },
      })
      onBeforeUnmount(unregister)

      function add() {
        if (devices.value.length >= 32 || savingList.value || busy.value) return
        draft.value = { id: null, label: '', mac: '' }
        editorError.value = ''
      }
      function edit(item) {
        if (savingList.value || busy.value) return
        draft.value = { ...item }
        editorError.value = ''
      }
      function cancel() {
        if (savingList.value) return
        draft.value = null
        editorError.value = ''
      }
      async function persist(items) {
        if (savingList.value || busy.value || !listValid(items)) return
        if (serialized(items) === saved.value) { cancel(); return }
        savingList.value = true
        editorError.value = ''
        pending.value = items
        try {
          if (await props.host.saveSettings()) draft.value = null
          else editorError.value = labels.saveError
        } catch (reason) {
          editorError.value = reason instanceof Error ? reason.message : String(reason)
        } finally {
          pending.value = null
          savingList.value = false
        }
      }
      function saveDevice() {
        if (draftValid.value) return persist(nextDevices.value)
      }
      function removeDevice() {
        if (draft.value?.id) return persist(devices.value.filter(item => item.id !== draft.value.id))
      }
      async function wake(item) {
        const mac = normalizeMAC(item.mac)
        if (!item.label.trim() || !macPattern.test(mac) || busy.value) return
        busy.value = item.id
        error.value = ''
        try {
          await props.host.invoke('wake', { mac })
          message.success(`${item.label.trim()}: ${labels.success}`)
        } catch (reason) {
          error.value = reason instanceof Error ? reason.message : String(reason)
        } finally {
          busy.value = ''
        }
      }
      async function wakeOnce() {
        const mac = normalizeMAC(oneTimeMac.value)
        if (!macPattern.test(mac) || busy.value) return
        busy.value = 'one-time'
        error.value = ''
        try {
          await props.host.invoke('wake', { mac })
          oneTimeMac.value = ''
          message.success(labels.success)
        } catch (reason) {
          error.value = reason instanceof Error ? reason.message : String(reason)
        } finally {
          busy.value = ''
        }
      }

      return () => h('section', { class: ['wol-page', { 'wol-page--tool': inToolbox }] }, [
        inToolbox ? null : h('p', { class: 'wol-description' }, labels.description),
        error.value ? h(NAlert, { type: 'error', showIcon: false }, { default: () => error.value }) : null,
        h('section', { class: 'wol-once' }, [
          h('h3', labels.oneTimeTitle),
          h('div', { class: 'wol-once-controls' }, [
            h(NInput, {
              class: 'wol-mac-input',
              inputProps: { 'aria-label': labels.mac, spellcheck: false },
              value: oneTimeMac.value,
              maxlength: 17,
              placeholder: labels.macPlaceholder,
              status: oneTimeMac.value && !macPattern.test(normalizeMAC(oneTimeMac.value)) ? 'error' : undefined,
              disabled: Boolean(busy.value) || savingList.value,
              'onUpdate:value': (value) => { oneTimeMac.value = value },
              onBlur: () => { oneTimeMac.value = normalizeMAC(oneTimeMac.value) },
              onKeyup: (event) => { if (event.key === 'Enter') wakeOnce() },
            }),
            h(NButton, {
              type: 'primary',
              loading: busy.value === 'one-time',
              disabled: !macPattern.test(normalizeMAC(oneTimeMac.value)) || Boolean(busy.value && busy.value !== 'one-time'),
              onClick: wakeOnce,
            }, { default: () => labels.wakeOnce }),
          ]),
        ]),
        h('div', { class: 'wol-list-heading' }, [
          h('div', { class: 'wol-list-title' }, [
            h('h3', labels.listTitle),
            h('span', { class: 'wol-count' }, String(devices.value.length)),
          ]),
          h(NButton, { secondary: true, size: 'small', disabled: devices.value.length >= 32 || Boolean(busy.value) || savingList.value, onClick: add }, { default: () => `+ ${labels.add}` }),
        ]),
        h('div', { class: 'wol-list' }, devices.value.length === 0 ? [
          h('div', { class: 'wol-empty' }, [
            h('strong', labels.empty),
            h('span', labels.emptyHint),
          ]),
        ] : devices.value.map((item) => h('article', { class: 'wol-device wol-device-view', key: item.id }, [
          h('div', { class: 'wol-device-copy' }, [
            h('strong', item.label.trim()),
            h('code', normalizeMAC(item.mac)),
          ]),
          h('div', { class: 'wol-device-actions wol-device-view-actions' }, [
            h(NButton, { quaternary: true, disabled: Boolean(busy.value) || savingList.value, onClick: () => edit(item) }, { default: () => labels.edit }),
            h(NButton, { type: 'primary', loading: busy.value === item.id, disabled: Boolean(busy.value && busy.value !== item.id), onClick: () => wake(item) }, { default: () => labels.wake }),
          ]),
        ]))),
        h(EditorWindow, {
          host: props.host, open: Boolean(draft.value),
          title: draft.value?.id ? labels.editTitle : labels.add,
          width: 440, height: 310, resizable: false, maximizable: false,
          beforeClose: () => !savingList.value, onClose: cancel,
        }, { default: () => draft.value ? h(DeviceForm, {
          draft: draft.value, error: tooLarge.value ? labels.tooLarge : editorError.value,
          macError: macError.value, valid: draftValid.value, saving: savingList.value,
          'onUpdate:label': value => { draft.value.label = value },
          'onUpdate:mac': value => { draft.value.mac = value },
          onSubmit: saveDevice, onCancel: cancel, onRemove: removeDevice,
        }) : null }),
        h('p', { class: 'wol-network-hint' }, labels.networkHint),
      ])
    },
  })

  const definition = {
    apiVersion: 1,
    component: Page,
    styles: [`
      .wol-page { display: grid; gap: 16px; container-type: inline-size; }
      .wol-page h3 { margin: 0; font-size: 14px; font-weight: 600; }
      .wol-description { margin: 0; color: var(--muted-foreground); }
      .wol-once { display: grid; gap: 12px; padding-bottom: 20px; border-bottom: 1px solid var(--border); }
      .wol-list-heading, .wol-list-title { display: flex; align-items: center; gap: 8px; }
      .wol-once-controls { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; }
      .wol-mac-input input, .wol-device-copy code { font-family: var(--onekvm-font-mono, ui-monospace, "SFMono-Regular", Menlo, Monaco, Consolas, "Liberation Mono", monospace); font-variant-numeric: tabular-nums slashed-zero; }
      .wol-list-heading { justify-content: space-between; }
      .wol-count { font-size: 12px; color: var(--muted-foreground); font-variant-numeric: tabular-nums; }
      .wol-list { display: grid; gap: 12px; }
      .wol-empty { border: 1px dashed var(--border); border-radius: 8px; display: grid; gap: 8px; padding: 32px 16px; text-align: center; }
      .wol-empty strong { font-size: 14px; font-weight: 500; }
      .wol-empty span { font-size: 13px; color: var(--muted-foreground); }
      .wol-device { padding: 12px; min-width: 0; border: 1px solid var(--border); border-radius: 8px; }
      .wol-device-view { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 12px; }
      .wol-device-copy { display: grid; gap: 4px; min-width: 0; }
      .wol-device-copy strong { font-size: 14px; font-weight: 500; overflow-wrap: anywhere; }
      .wol-device-copy code { color: var(--muted-foreground); font-size: 12px; line-height: 1.5; }
      .wol-device-form { display: grid; gap: 20px; margin: 0; }
      .wol-field { display: grid; gap: 8px; min-width: 0; }
      .wol-field > span { font-size: 12px; font-weight: 500; color: var(--muted-foreground); }
      .wol-field-message { display: block; line-height: 1.5; font-size: 12px; }
      .wol-error { color: var(--destructive); }
      .wol-device-actions { display: flex; justify-content: flex-end; align-items: center; gap: 8px; flex-wrap: wrap; }
      .wol-editor-actions { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
      .wol-network-hint { margin: 0; font-size: 12px; line-height: 1.6; color: var(--muted-foreground); }
      @container (max-width: 400px) {
        .wol-device-view { grid-template-columns: minmax(0, 1fr); gap: 8px; }
      }
      @container (max-width: 260px) { .wol-once-controls { grid-template-columns: minmax(0, 1fr); } }
    `],
  }
  if (inToolbox) runtime.toolbox.register('wake-on-lan', 'wake', definition)
  else runtime.register('wake-on-lan', definition)
})()
