import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import './App.css'

type MenuItem = {
  id: number
  nombreProducto: string
  precio: number
}

type OrderStatus = 'PENDIENTE' | 'PREPARANDO' | 'LISTO' | 'ENTREGADO'

type OrderDetail = {
  id: number
  menuId: number
  nombreProducto: string
  cantidad: number
  precio: number
}

type Order = {
  id: number
  cliente: string
  estado: OrderStatus
  fechaCreacion: string
  fechaActualizacion: string
  detalles: OrderDetail[]
}

type Page = 'inicio' | 'carta' | 'pedidos'
type Notice = { kind: 'success' | 'error'; text: string }
type OrderLine = { id: number; menuId: string; cantidad: string }
type IconName = 'home' | 'menu' | 'orders' | 'plus' | 'refresh' | 'clock' | 'chef' | 'check' | 'arrow' | 'close' | 'bag'

const iconContent: Record<IconName, ReactNode> = {
  home: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /></>,
  menu: <><path d="M4 6h16M4 12h16M4 18h16" /><circle cx="7" cy="6" r=".5" /><circle cx="7" cy="12" r=".5" /><circle cx="7" cy="18" r=".5" /></>,
  orders: <><path d="M6 3h12l2 3v15H4V6l2-3Z" /><path d="M4 7h16M8 11h8M8 15h5" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  refresh: <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M5.6 9a7 7 0 0 1 11.6-2L20 12M4 12l2.8 5a7 7 0 0 0 11.6-2" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  chef: <><path d="M6 13a4 4 0 1 1 1.5-7.7A5 5 0 0 1 17 7a3.5 3.5 0 1 1 1 6.8V20H6v-7Z" /><path d="M10 16v1M14 16v1" /></>,
  check: <><path d="m5 12 4 4L19 6" /></>,
  arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
  close: <><path d="m6 6 12 12M18 6 6 18" /></>,
  bag: <><path d="M5 8h14l1 13H4L5 8Z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></>,
}

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {iconContent[name]}
    </svg>
  )
}

async function request<T>(path: string, init?: RequestInit): Promise<T | null> {
  const headers = new Headers(init?.headers)
  if (init?.body) headers.set('Content-Type', 'application/json')

  const response = await fetch(`/api${path}`, { ...init, headers })

  if (!response.ok) {
    const body = await response.text()
    let message = body || `Error de la API (${response.status}).`

    if (body) {
      try {
        const payload: unknown = JSON.parse(body)
        if (typeof payload === 'object' && payload !== null) {
          const record = payload as Record<string, unknown>
          const detail = record.message ?? record.detail ?? record.error
          if (typeof detail === 'string') message = detail
        }
      } catch {
        message = body
      }
    }

    throw new Error(message)
  }

  if (response.status === 204) return null
  return (await response.json()) as T
}

async function fetchDashboardData() {
  const [menuResponse, orderResponse] = await Promise.all([
    request<MenuItem[]>('/menus'),
    request<Order[]>('/pedidos'),
  ])
  if (!menuResponse || !orderResponse) {
    throw new Error('La API devolvió una respuesta vacía.')
  }
  return { menus: menuResponse, orders: orderResponse }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Ocurrió un error inesperado.'
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Hora no disponible'
  return new Intl.DateTimeFormat('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function statusLabel(status: OrderStatus) {
  return {
    PENDIENTE: 'Pendiente',
    PREPARANDO: 'Preparando',
    LISTO: 'Listo',
    ENTREGADO: 'Entregado',
  }[status]
}

function App() {
  const [page, setPage] = useState<Page>('inicio')
  const [menus, setMenus] = useState<MenuItem[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [notice, setNotice] = useState<Notice | null>(null)
  const [menuModalOpen, setMenuModalOpen] = useState(false)
  const [orderModalOpen, setOrderModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [productName, setProductName] = useState('')
  const [productPrice, setProductPrice] = useState('')
  const [customer, setCustomer] = useState('')
  const [orderLines, setOrderLines] = useState<OrderLine[]>([{ id: 1, menuId: '', cantidad: '1' }])
  const nextLineId = useRef(1)

  const refreshData = useCallback(async () => {
    try {
      const data = await fetchDashboardData()
      setMenus(data.menus)
      setOrders(data.orders)
      setLoadError('')
    } catch (error) {
      setLoadError(getErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }, [])

  function handleRefresh() {
    setLoading(true)
    void refreshData()
  }

  useEffect(() => {
    let cancelled = false

    void fetchDashboardData()
      .then((data) => {
        if (cancelled) return
        setMenus(data.menus)
        setOrders(data.orders)
        setLoadError('')
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(getErrorMessage(error))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const pendingOrders = orders
    .filter((order) => order.estado === 'PENDIENTE')
    .sort((a, b) => a.id - b.id)
  const latestOrders = [...orders].sort(
    (a, b) => new Date(b.fechaCreacion).getTime() - new Date(a.fechaCreacion).getTime(),
  )

  async function takeNextOrder() {
    setSaving(true)
    try {
      const order = await request<Order>('/pedidos/siguiente', { method: 'POST' })
      if (!order) {
        setNotice({ kind: 'success', text: 'No hay pedidos pendientes en la cola.' })
      } else {
        setNotice({ kind: 'success', text: `El pedido #${order.id} ya está en preparación.` })
        await refreshData()
      }
    } catch (error) {
      setNotice({ kind: 'error', text: getErrorMessage(error) })
    } finally {
      setSaving(false)
    }
  }

  async function advanceOrder(order: Order) {
    const action = order.estado === 'PREPARANDO' ? 'listo' : 'entregado'
    const nextState = order.estado === 'PREPARANDO' ? 'listo' : 'entregado'
    setSaving(true)
    try {
      await request<Order>(`/pedidos/${order.id}/${action}`, { method: 'POST' })
      setNotice({
        kind: 'success',
        text: `Pedido #${order.id}: ${nextState === 'listo' ? 'marcado como listo' : 'marcado como entregado'}.`,
      })
      await refreshData()
    } catch (error) {
      setNotice({ kind: 'error', text: getErrorMessage(error) })
    } finally {
      setSaving(false)
    }
  }

  async function createMenuItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    try {
      const created = await request<MenuItem>('/menus', {
        method: 'POST',
        body: JSON.stringify({
          nombreProducto: productName.trim(),
          precio: Number(productPrice),
        }),
      })
      if (!created) throw new Error('La API no devolvió el producto creado.')
      setProductName('')
      setProductPrice('')
      setMenuModalOpen(false)
      setNotice({ kind: 'success', text: `${created.nombreProducto} se agregó a la carta.` })
      await refreshData()
    } catch (error) {
      setNotice({ kind: 'error', text: getErrorMessage(error) })
    } finally {
      setSaving(false)
    }
  }

  async function createOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const details = orderLines.map((line) => ({
      menuId: Number(line.menuId),
      cantidad: Number(line.cantidad),
    }))

    if (details.some((detail) => !detail.menuId || !Number.isInteger(detail.cantidad) || detail.cantidad < 1)) {
      setNotice({ kind: 'error', text: 'Revisá los productos y cantidades del pedido.' })
      return
    }

    setSaving(true)
    try {
      const created = await request<Order>('/pedidos', {
        method: 'POST',
        body: JSON.stringify({ cliente: customer.trim(), detalles: details }),
      })
      if (!created) throw new Error('La API no devolvió el pedido creado.')
      setCustomer('')
      setOrderLines([{ id: 1, menuId: '', cantidad: '1' }])
      nextLineId.current = 1
      setOrderModalOpen(false)
      setNotice({ kind: 'success', text: `Pedido #${created.id} agregado a la cola.` })
      await refreshData()
    } catch (error) {
      setNotice({ kind: 'error', text: getErrorMessage(error) })
    } finally {
      setSaving(false)
    }
  }

  const pageTitle = page === 'inicio' ? 'Resumen' : page === 'carta' ? 'Carta' : 'Pedidos'

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#" onClick={() => setPage('inicio')}>
          <span className="brand-mark" aria-hidden="true">PQ</span>
          <span className="brand-name">Pancho<span>Queue</span></span>
        </a>

        <div className="sidebar-label">GESTIÓN</div>
        <nav className="main-nav" aria-label="Navegación principal">
          {([
            { id: 'inicio', label: 'Inicio', icon: 'home' },
            { id: 'carta', label: 'Carta', icon: 'menu' },
            { id: 'pedidos', label: 'Pedidos', icon: 'orders' },
          ] as const).map((item) => (
            <button
              className={`nav-item ${page === item.id ? 'active' : ''}`}
              key={item.id}
              onClick={() => setPage(item.id)}
              type="button"
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
              {item.id === 'pedidos' && pendingOrders.length > 0 && (
                <span className="nav-count">{pendingOrders.length}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-help">
            <div className="help-icon"><Icon name="chef" size={17} /></div>
            <div>
              <strong>¡A cocinar!</strong>
              <span>Tu local, en orden.</span>
            </div>
          </div>
          <div className="sidebar-version">PANCHOQUEUE · ADMIN</div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb"><span>PanchoQueue</span><span className="breadcrumb-separator">/</span><strong>{pageTitle}</strong></div>
          <div className="topbar-actions">
            <span className={`connection ${loadError ? 'offline' : loading ? 'connecting' : 'online'}`}>
              <span className="connection-dot" />
              {loadError ? 'Sin conexión' : loading ? 'Conectando…' : 'API conectada'}
            </span>
            <button
              aria-label="Actualizar datos"
              className="icon-button refresh-button"
              disabled={loading}
              onClick={handleRefresh}
              title="Actualizar datos"
              type="button"
            >
              <Icon name="refresh" />
            </button>
            <div className="user-avatar" aria-label="Administrador">PQ</div>
          </div>
        </header>

        <div className="page-content">
          {loadError && (
            <div className="api-alert" role="alert">
              <div>
                <strong>No pudimos cargar los datos</strong>
                <span>{loadError}. Verificá que el backend esté disponible en localhost:8080.</span>
              </div>
              <button className="text-button" onClick={handleRefresh} type="button">Reintentar</button>
            </div>
          )}

          {page === 'inicio' && (
            <>
              <section className="welcome-card">
                <div className="welcome-copy">
                  <span className="eyebrow">PANEL DE CONTROL</span>
                  <h1>¡Qué bueno verte!</h1>
                  <p>Todo lo que pasa en tu local, de un vistazo.</p>
                  <div className="welcome-actions">
                    <button className="button button-dark" onClick={() => setPage('pedidos')} type="button">
                      Ver pedidos <Icon name="arrow" size={16} />
                    </button>
                    <button className="button button-light" onClick={() => setOrderModalOpen(true)} type="button">
                      <Icon name="plus" size={17} /> Nuevo pedido
                    </button>
                  </div>
                </div>
                <div className="hotdog-art" aria-hidden="true">
                  <span className="hotdog-shadow" />
                  <span className="hotdog-bun" />
                  <span className="hotdog-sausage" />
                  <span className="hotdog-mustard" />
                  <span className="hotdog-pickle pickle-one" />
                  <span className="hotdog-pickle pickle-two" />
                  <span className="art-sparkle sparkle-one">✦</span>
                  <span className="art-sparkle sparkle-two">✦</span>
                </div>
                <div className="welcome-stamp">HECHO<br />CON AMOR</div>
              </section>

              <section className="stats-grid" aria-label="Resumen de pedidos">
                <StatCard label="En cola" value={pendingOrders.length} note="Esperando preparación" icon="clock" tone="orange" />
                <StatCard label="Preparando" value={orders.filter((order) => order.estado === 'PREPARANDO').length} note="En la cocina" icon="chef" tone="blue" />
                <StatCard label="Listos" value={orders.filter((order) => order.estado === 'LISTO').length} note="Para entregar" icon="check" tone="green" />
                <StatCard label="Productos" value={menus.length} note="En tu carta" icon="bag" tone="purple" />
              </section>

              <div className="dashboard-grid">
                <section className="panel queue-panel">
                  <div className="panel-heading">
                    <div>
                      <span className="eyebrow">SIGUIENTE EN LA FILA</span>
                      <h2>Pedidos pendientes</h2>
                    </div>
                    <button
                      className="button button-primary button-small"
                      disabled={saving || loading || pendingOrders.length === 0}
                      onClick={() => void takeNextOrder()}
                      type="button"
                    >
                      <Icon name="chef" size={16} /> Preparar siguiente
                    </button>
                  </div>
                  {pendingOrders.length === 0 ? (
                    <EmptyState
                      icon="check"
                      title={loading ? 'Cargando pedidos…' : 'La fila está vacía'}
                      text={loading ? 'Enseguida te mostramos las novedades.' : 'Cuando entre un pedido, lo vas a ver acá.'}
                    />
                  ) : (
                    <div className="queue-list">
                      {pendingOrders.slice(0, 4).map((order) => (
                        <OrderRow key={order.id} order={order} />
                      ))}
                    </div>
                  )}
                  {pendingOrders.length > 4 && (
                    <button className="panel-link" onClick={() => setPage('pedidos')} type="button">
                      Ver los {pendingOrders.length} pedidos <Icon name="arrow" size={15} />
                    </button>
                  )}
                </section>

                <section className="panel latest-panel">
                  <div className="panel-heading">
                    <div>
                      <span className="eyebrow">ACTIVIDAD RECIENTE</span>
                      <h2>Últimos pedidos</h2>
                    </div>
                    <button className="panel-link" onClick={() => setPage('pedidos')} type="button">
                      Ver todos <Icon name="arrow" size={15} />
                    </button>
                  </div>
                  {latestOrders.length === 0 ? (
                    <EmptyState icon="orders" title="Todavía no hay pedidos" text="Los pedidos nuevos aparecerán acá." />
                  ) : (
                    <div className="latest-list">
                      {latestOrders.slice(0, 4).map((order) => (
                        <div className="latest-order" key={order.id}>
                          <div className="order-avatar">{order.cliente.trim().slice(0, 1).toUpperCase() || 'P'}</div>
                          <div className="latest-order-info">
                            <strong>{order.cliente}</strong>
                            <span>Pedido #{order.id} · {formatTime(order.fechaCreacion)}</span>
                          </div>
                          <StatusBadge status={order.estado} />
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            </>
          )}

          {page === 'carta' && (
            <section className="content-section">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">LO QUE HACE ESPECIAL A TU LOCAL</span>
                  <h1>Tu carta</h1>
                  <p>Administrá los productos que ofrecés.</p>
                </div>
                <button className="button button-primary" onClick={() => setMenuModalOpen(true)} type="button">
                  <Icon name="plus" size={17} /> Agregar producto
                </button>
              </div>
              {menus.length === 0 ? (
                <EmptyState
                  icon="menu"
                  title={loading ? 'Cargando la carta…' : 'Todavía no hay productos'}
                  text={loading ? 'Estamos buscando tus productos.' : 'Agregá el primer producto para empezar a tomar pedidos.'}
                  action={!loading && <button className="button button-primary" onClick={() => setMenuModalOpen(true)} type="button"><Icon name="plus" size={17} /> Agregar producto</button>}
                />
              ) : (
                <div className="products-grid">
                  {menus.map((item, index) => (
                    <article className="product-card" key={item.id}>
                      <div className={`product-visual product-visual-${index % 4}`}>
                        <span className="product-initial">{item.nombreProducto.slice(0, 1).toUpperCase()}</span>
                        <span className="product-tag">EN CARTA</span>
                      </div>
                      <div className="product-info">
                        <div><h2>{item.nombreProducto}</h2><span>Producto #{item.id}</span></div>
                        <strong>{formatCurrency(item.precio)}</strong>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}

          {page === 'pedidos' && (
            <section className="content-section">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">LA COLA DEL LOCAL</span>
                  <h1>Pedidos</h1>
                  <p>Seguí cada pedido desde que entra hasta que se entrega.</p>
                </div>
                <button className="button button-primary" onClick={() => setOrderModalOpen(true)} type="button">
                  <Icon name="plus" size={17} /> Nuevo pedido
                </button>
              </div>
              <div className="order-summary">
                <span><i className="summary-dot dot-pending" /> {pendingOrders.length} pendientes</span>
                <span><i className="summary-dot dot-preparing" /> {orders.filter((order) => order.estado === 'PREPARANDO').length} preparando</span>
                <span><i className="summary-dot dot-ready" /> {orders.filter((order) => order.estado === 'LISTO').length} listos</span>
              </div>
              {latestOrders.length === 0 ? (
                <EmptyState icon="orders" title={loading ? 'Cargando pedidos…' : 'Todavía no hay pedidos'} text="Cuando se cree un pedido, va a aparecer en esta lista." />
              ) : (
                <div className="panel orders-panel">
                  {latestOrders.map((order) => (
                    <div className="order-card" key={order.id}>
                      <div className="order-card-main">
                        <div className="order-avatar order-avatar-large">{order.cliente.trim().slice(0, 1).toUpperCase() || 'P'}</div>
                        <div className="order-card-info">
                          <div className="order-card-title"><h2>{order.cliente}</h2><span>#{order.id}</span></div>
                          <p>{order.detalles.map((detail) => `${detail.cantidad} × ${detail.nombreProducto}`).join(' · ')}</p>
                          <span className="order-time"><Icon name="clock" size={14} /> Ingresó a las {formatTime(order.fechaCreacion)}</span>
                        </div>
                      </div>
                      <div className="order-card-actions">
                        <StatusBadge status={order.estado} />
                        {order.estado === 'PREPARANDO' && (
                          <button className="button button-outline button-small" disabled={saving} onClick={() => void advanceOrder(order)} type="button">
                            Marcar listo <Icon name="check" size={15} />
                          </button>
                        )}
                        {order.estado === 'LISTO' && (
                          <button className="button button-outline button-small" disabled={saving} onClick={() => void advanceOrder(order)} type="button">
                            Entregar <Icon name="arrow" size={15} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      </main>

      {notice && (
        <div className={`toast toast-${notice.kind}`} role={notice.kind === 'error' ? 'alert' : 'status'}>
          <span className="toast-icon"><Icon name={notice.kind === 'success' ? 'check' : 'close'} size={17} /></span>
          <span>{notice.text}</span>
          <button aria-label="Cerrar aviso" onClick={() => setNotice(null)} type="button"><Icon name="close" size={16} /></button>
        </div>
      )}

      {menuModalOpen && (
        <Modal title="Agregar a la carta" subtitle="Sumá un producto nuevo a tu menú." onClose={() => setMenuModalOpen(false)}>
          <form className="form-stack" onSubmit={(event) => void createMenuItem(event)}>
            <label>
              Nombre del producto
              <input autoFocus maxLength={120} onChange={(event) => setProductName(event.target.value)} placeholder="Ej. Pancho clásico" required value={productName} />
            </label>
            <label>
              Precio
              <div className="input-prefix"><span>$</span><input min="1" onChange={(event) => setProductPrice(event.target.value)} placeholder="2500" required step="0.01" type="number" value={productPrice} /></div>
            </label>
            <div className="modal-actions">
              <button className="button button-secondary" onClick={() => setMenuModalOpen(false)} type="button">Cancelar</button>
              <button className="button button-primary" disabled={saving} type="submit">{saving ? 'Guardando…' : 'Guardar producto'}</button>
            </div>
          </form>
        </Modal>
      )}

      {orderModalOpen && (
        <Modal title="Crear pedido" subtitle="Cargá el pedido y sumalo a la cola." onClose={() => setOrderModalOpen(false)}>
          {menus.length === 0 ? (
            <div className="modal-empty">
              <p>Primero necesitás agregar productos a la carta.</p>
              <button className="button button-primary" onClick={() => { setOrderModalOpen(false); setPage('carta'); setMenuModalOpen(true) }} type="button">
                <Icon name="plus" size={16} /> Agregar producto
              </button>
            </div>
          ) : (
            <form className="form-stack" onSubmit={(event) => void createOrder(event)}>
              <label>
                Nombre del cliente
                <input autoFocus maxLength={255} onChange={(event) => setCustomer(event.target.value)} placeholder="Ej. Ana" required value={customer} />
              </label>
              <div className="form-label-row"><span>Productos</span><button className="inline-add" onClick={() => { nextLineId.current += 1; setOrderLines((lines) => [...lines, { id: nextLineId.current, menuId: '', cantidad: '1' }]) }} type="button"><Icon name="plus" size={14} /> Agregar otro</button></div>
              {orderLines.map((line) => (
                <div className="order-line" key={line.id}>
                  <select aria-label="Producto" onChange={(event) => setOrderLines((lines) => lines.map((item) => item.id === line.id ? { ...item, menuId: event.target.value } : item))} required value={line.menuId}>
                    <option value="">Elegí un producto</option>
                    {menus.map((menuItem) => <option key={menuItem.id} value={menuItem.id}>{menuItem.nombreProducto} — {formatCurrency(menuItem.precio)}</option>)}
                  </select>
                  <input aria-label="Cantidad" min="1" onChange={(event) => setOrderLines((lines) => lines.map((item) => item.id === line.id ? { ...item, cantidad: event.target.value } : item))} required type="number" value={line.cantidad} />
                  {orderLines.length > 1 && <button aria-label="Quitar producto" className="remove-line" onClick={() => setOrderLines((lines) => lines.filter((item) => item.id !== line.id))} type="button"><Icon name="close" size={16} /></button>}
                </div>
              ))}
              <div className="modal-actions">
                <button className="button button-secondary" onClick={() => setOrderModalOpen(false)} type="button">Cancelar</button>
                <button className="button button-primary" disabled={saving} type="submit">{saving ? 'Creando…' : 'Crear pedido'}</button>
              </div>
            </form>
          )}
        </Modal>
      )}
    </div>
  )
}

function StatCard({ label, value, note, icon, tone }: { label: string; value: number; note: string; icon: IconName; tone: string }) {
  return (
    <article className="stat-card">
      <div className={`stat-icon stat-${tone}`}><Icon name={icon} size={19} /></div>
      <div className="stat-copy"><span>{label}</span><strong>{value}</strong><small>{note}</small></div>
      <span className="stat-accent" />
    </article>
  )
}

function EmptyState({ icon, title, text, action }: { icon: IconName; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="empty-state">
      <div className="empty-icon"><Icon name={icon} size={22} /></div>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  )
}

function OrderRow({ order }: { order: Order }) {
  return (
    <div className="queue-row">
      <div className="queue-number">{String(order.id).padStart(2, '0')}</div>
      <div className="queue-info">
        <strong>{order.cliente}</strong>
        <span>{order.detalles.map((detail) => `${detail.cantidad} × ${detail.nombreProducto}`).join(' · ')}</span>
      </div>
      <span className="queue-time"><Icon name="clock" size={14} /> {formatTime(order.fechaCreacion)}</span>
    </div>
  )
}

function StatusBadge({ status }: { status: OrderStatus }) {
  return <span className={`status-badge status-${status.toLowerCase()}`}><i />{statusLabel(status)}</span>
}

function Modal({ title, subtitle, onClose, children }: { title: string; subtitle: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section aria-labelledby="modal-title" aria-modal="true" className="modal-card" role="dialog">
        <div className="modal-heading">
          <div><h2 id="modal-title">{title}</h2><p>{subtitle}</p></div>
          <button aria-label="Cerrar" className="icon-button" onClick={onClose} type="button"><Icon name="close" /></button>
        </div>
        {children}
      </section>
    </div>
  )
}

export default App
