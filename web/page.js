(() => {
  const runtime = window.OneKVMPluginUI.v1
  const { computed, defineComponent, h, onBeforeUnmount, ref } = runtime.vue
  const { NAlert, NButton, NInput, useMessage } = runtime.naive
  const macPattern = /^(?:[0-9a-fA-F]{2}[:-]){5}[0-9a-fA-F]{2}$/
  const labels = runtime.i18n.createMessages({
    'zh-TW': { title: '網路喚醒裝置', description: '儲存一個或多個「標籤 + MAC 位址」，並從清單直接傳送喚醒封包。', listTitle: '裝置清單', oneTimeTitle: '臨時喚醒', oneTimeDescription: '輸入需要喚醒的 MAC 位址', label: '標籤', labelPlaceholder: '例如：辦公室電腦', mac: 'MAC 位址', macPlaceholder: '00:11:22:33:44:55', invalid: 'MAC 位址格式不正確。', duplicate: 'MAC 位址不能重複。', tooLarge: '裝置清單超過 4 KiB，請縮短標籤或刪除部分裝置。', add: '新增裝置', remove: '刪除', edit: '編輯', confirm: '確認', wake: '喚醒', wakeOnce: '傳送喚醒', saveList: '儲存清單', success: '喚醒封包已傳送。', empty: '尚未儲存裝置，請先新增一項。' },
    zh: { title: '网络唤醒设备', description: '保存一个或多个“标签 + MAC 地址”，并从列表直接发送唤醒包。', listTitle: '设备列表', oneTimeTitle: '临时唤醒', oneTimeDescription: '输入需要唤醒的 MAC 地址', label: '标签', labelPlaceholder: '例如：办公室电脑', mac: 'MAC 地址', macPlaceholder: '00:11:22:33:44:55', invalid: 'MAC 地址格式不正确。', duplicate: 'MAC 地址不能重复。', tooLarge: '设备列表超过 4 KiB，请缩短标签或删除部分设备。', add: '添加设备', remove: '删除', edit: '编辑', confirm: '确认', wake: '唤醒', wakeOnce: '发送唤醒', saveList: '保存列表', success: '唤醒包已发送。', empty: '还没有保存设备，请先添加一项。' },
    en: { title: 'Wake-on-LAN devices', description: 'Save one or more labelled MAC addresses and wake any device directly from the list.', listTitle: 'Device list', oneTimeTitle: 'Quick wake', oneTimeDescription: 'Enter the MAC address to wake', label: 'Label', labelPlaceholder: 'For example: Office PC', mac: 'MAC address', macPlaceholder: '00:11:22:33:44:55', invalid: 'Use a valid MAC address.', duplicate: 'MAC addresses must be unique.', tooLarge: 'The device list exceeds 4 KiB. Shorten labels or remove some devices.', add: 'Add device', remove: 'Remove', edit: 'Edit', confirm: 'Confirm', wake: 'Wake', wakeOnce: 'Send wake', saveList: 'Save list', success: 'Wake packet sent.', empty: 'No devices yet. Add one to get started.' },
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
        editing: false,
      }))
    } catch (_) {
      return []
    }
  }

  function serialized(devices) {
    return JSON.stringify(devices.map(({ label, mac }) => ({ label: label.trim(), mac: normalizeMAC(mac) })))
  }

  const Page = defineComponent({
    name: 'WakeOnLANPage',
    props: { host: { type: Object, required: true } },
    setup(props) {
      const initial = String(props.host.extension.value.settings.devices_json || '[]')
      const devices = ref(parseDevices(initial))
      const saved = ref(serialized(devices.value))
      const savingList = ref(false)
      const oneTimeMac = ref('')
      const busy = ref('')
      const error = ref('')
      const message = useMessage()
      const duplicates = computed(() => {
        const seen = new Set()
        const duplicate = new Set()
        for (const item of devices.value) {
          const mac = normalizeMAC(item.mac)
          if (!mac) continue
          if (seen.has(mac)) duplicate.add(mac)
          seen.add(mac)
        }
        return duplicate
      })
      const tooLarge = computed(() => new TextEncoder().encode(serialized(devices.value)).byteLength > 4096)
      const valid = computed(() => !tooLarge.value && devices.value.length <= 32 && duplicates.value.size === 0 && devices.value.every((item) =>
        !item.editing && item.label.trim().length > 0 && item.label.trim().length <= 64 && macPattern.test(item.mac.trim())))
      const dirty = computed(() => serialized(devices.value) !== saved.value)
      const unregister = props.host.registerSettings({
        dirty,
        valid,
        showHostActions: false,
        collect: () => ({ devices_json: serialized(devices.value) }),
        reset: (settings) => {
          devices.value = parseDevices(settings.devices_json)
          saved.value = serialized(devices.value)
          error.value = ''
        },
      })
      onBeforeUnmount(unregister)

      function add() {
        if (devices.value.length >= 32) return
        devices.value.push({ id: `${Date.now()}-${Math.random()}`, label: '', mac: '', editing: true })
      }
      function remove(id) {
        devices.value = devices.value.filter((item) => item.id !== id)
      }
      function itemValid(item) {
        const mac = normalizeMAC(item.mac)
        return !tooLarge.value && item.label.trim().length > 0 && item.label.trim().length <= 64 &&
          macPattern.test(mac) && !duplicates.value.has(mac)
      }
      function macError(item) {
        const mac = normalizeMAC(item.mac)
        if (!mac) return ''
        if (duplicates.value.has(mac)) return labels.duplicate
        return macPattern.test(mac) ? '' : labels.invalid
      }
      function confirm(item) {
        if (!itemValid(item) || busy.value || savingList.value) return
        item.label = item.label.trim()
        item.mac = normalizeMAC(item.mac)
        item.editing = false
      }
      async function saveList() {
        if (!valid.value || savingList.value || busy.value) return
        if (!dirty.value) return
        savingList.value = true
        error.value = ''
        try {
          await props.host.saveSettings()
        } catch (reason) {
          error.value = reason instanceof Error ? reason.message : String(reason)
        } finally {
          savingList.value = false
        }
      }
      async function wake(item) {
        const mac = normalizeMAC(item.mac)
        if (!item.label.trim() || !macPattern.test(mac) || duplicates.value.has(mac) || busy.value) return
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

      return () => h('section', { class: 'wol-page' }, [
        h('h2', labels.title),
        h('p', { class: 'wol-description' }, labels.description),
        error.value ? h(NAlert, { type: 'error', showIcon: false }, { default: () => error.value }) : null,
        tooLarge.value ? h(NAlert, { type: 'warning', showIcon: false }, { default: () => labels.tooLarge }) : null,
        h('article', { class: 'wol-once' }, [
          h('div', { class: 'wol-once-copy' }, [
            h('strong', labels.oneTimeTitle),
            h('small', labels.oneTimeDescription),
          ]),
          h(NInput, {
            value: oneTimeMac.value,
            maxlength: 17,
            placeholder: labels.macPlaceholder,
            status: oneTimeMac.value && !macPattern.test(normalizeMAC(oneTimeMac.value)) ? 'error' : undefined,
            disabled: Boolean(busy.value),
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
        h('div', { class: 'wol-list-heading' }, [
          h('strong', labels.listTitle),
        ]),
        devices.value.length === 0 ? h('div', { class: 'wol-empty' }, labels.empty) : null,
        ...devices.value.map((item) => item.editing ? h('article', { class: 'wol-device', key: item.id }, [
          h('label', { class: 'wol-field' }, [
            h('span', labels.label),
            h(NInput, {
              value: item.label,
              maxlength: 64,
              placeholder: labels.labelPlaceholder,
              disabled: Boolean(busy.value),
              'onUpdate:value': (value) => { item.label = value },
            }),
            h('small', { class: 'wol-field-message', 'aria-hidden': 'true' }, '\u00a0'),
          ]),
          h('label', { class: 'wol-field' }, [
            h('span', labels.mac),
            h(NInput, {
              value: item.mac,
              maxlength: 17,
              placeholder: labels.macPlaceholder,
              status: item.mac && (!macPattern.test(item.mac.trim()) || duplicates.value.has(normalizeMAC(item.mac))) ? 'error' : undefined,
              disabled: Boolean(busy.value),
              'onUpdate:value': (value) => { item.mac = value },
              onBlur: () => { item.mac = normalizeMAC(item.mac) },
              onKeyup: (event) => { if (event.key === 'Enter') confirm(item) },
            }),
            h('small', {
              class: `wol-field-message${macError(item) ? ' wol-error' : ''}`,
              'aria-hidden': macError(item) ? undefined : 'true',
            }, macError(item) || '\u00a0'),
          ]),
          h('div', { class: 'wol-device-actions' }, [
            h(NButton, { secondary: true, disabled: Boolean(busy.value), onClick: () => remove(item.id) }, { default: () => labels.remove }),
            h(NButton, { type: 'primary', disabled: !itemValid(item) || Boolean(busy.value) || savingList.value, onClick: () => confirm(item) }, { default: () => labels.confirm }),
          ]),
        ]) : h('article', { class: 'wol-device wol-device-view', key: item.id }, [
          h('div', { class: 'wol-device-copy' }, [
            h('strong', item.label.trim()),
            h('code', normalizeMAC(item.mac)),
          ]),
          h('div', { class: 'wol-device-actions wol-device-view-actions' }, [
            h(NButton, { secondary: true, disabled: Boolean(busy.value) || savingList.value, onClick: () => { item.editing = true } }, { default: () => labels.edit }),
            h(NButton, { type: 'primary', loading: busy.value === item.id, disabled: Boolean(busy.value && busy.value !== item.id), onClick: () => wake(item) }, { default: () => labels.wake }),
          ]),
        ])),
        h('div', { class: 'wol-add' }, [
          h(NButton, { dashed: true, disabled: devices.value.length >= 32 || Boolean(busy.value) || savingList.value, onClick: add }, { default: () => `+ ${labels.add}` }),
          h(NButton, { type: 'primary', loading: savingList.value, disabled: !dirty.value || !valid.value || Boolean(busy.value), onClick: saveList }, { default: () => labels.saveList }),
        ]),
      ])
    },
  })

  runtime.register('wake-on-lan', {
    apiVersion: 1,
    component: Page,
    styles: [`
      .wol-page { display: grid; gap: 14px; }
      .wol-page h2 { margin: 0; font-size: 18px; }
      .wol-description { margin: 0; color: var(--n-text-color-3, #888); }
      .wol-once { display: grid; grid-template-columns: minmax(180px, .8fr) minmax(220px, 1fr) auto; align-items: center; gap: 12px; padding: 14px; border: 1px solid var(--n-border-color, #444); border-radius: 8px; }
      .wol-once-copy { display: grid; gap: 4px; }
      .wol-once-copy small { color: var(--n-text-color-3, #888); }
      .wol-empty { padding: 22px; border: 1px dashed var(--n-border-color, #444); border-radius: 8px; text-align: center; color: var(--n-text-color-3, #888); }
      .wol-list-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
      .wol-device { display: grid; grid-template-columns: minmax(160px, .8fr) minmax(220px, 1fr) auto; align-items: stretch; gap: 12px; padding: 14px; border: 1px solid var(--n-border-color, #444); border-radius: 8px; }
      .wol-device-view { grid-template-columns: minmax(0, 1fr) auto; align-items: center; }
      .wol-device-copy { display: grid; gap: 5px; min-width: 0; }
      .wol-device-copy code { color: var(--n-text-color-1, #e5e7eb); font-family: var(--onekvm-font-mono, ui-monospace, "SFMono-Regular", Menlo, Monaco, Consolas, "Liberation Mono", monospace); font-size: 13px; font-feature-settings: "tnum" 1, "zero" 1; font-variant-numeric: tabular-nums slashed-zero; font-weight: 500; line-height: 1.5; letter-spacing: .01em; }
      .wol-field { display: grid; gap: 7px; }
      .wol-field > span { font-size: 13px; font-weight: 600; }
      .wol-field-message { display: block; min-height: 16px; line-height: 16px; font-size: 12px; }
      .wol-error { color: var(--n-color-error, #d03050); }
      .wol-device-actions { display: flex; align-self: center; justify-content: flex-end; align-items: center; gap: 8px; padding-top: 5px; }
      .wol-add { display: flex; justify-content: space-between; gap: 8px; }
      @media (max-width: 760px) { .wol-once, .wol-device { grid-template-columns: 1fr; align-items: stretch; } .wol-device-actions { align-self: stretch; justify-content: flex-end; } }
    `],
  })
})()
