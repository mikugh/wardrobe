import { useState, type ReactNode } from 'react'
import { AddItem } from './components/AddItem'
import { BagsView } from './components/BagsView'
import { BagIcon, CameraIcon, LayersIcon, SettingsIcon, ShirtIcon } from './components/icons'
import { OutfitsView } from './components/OutfitsView'
import { SettingsSheet } from './components/SettingsSheet'
import { WardrobeView } from './components/WardrobeView'

type Tab = 'wardrobe' | 'outfits' | 'bags'

export default function App() {
  const [tab, setTab] = useState<Tab>('wardrobe')
  const [adding, setAdding] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const startAdding = () => {
    setTab('wardrobe')
    setAdding(true)
  }

  return (
    <div className="min-h-dvh pb-28">
      {tab === 'wardrobe' ? <WardrobeView onAdd={startAdding} /> : tab === 'outfits' ? <OutfitsView /> : <BagsView />}

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-stone-200 bg-paper/90 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="mx-auto grid h-16 max-w-md grid-cols-5 items-center">
          <TabButton active={tab === 'wardrobe'} onClick={() => setTab('wardrobe')} icon={<ShirtIcon />} label="Wardrobe" />
          <TabButton active={tab === 'outfits'} onClick={() => setTab('outfits')} icon={<LayersIcon />} label="Outfits" />
          <div className="flex justify-center">
            <button
              onClick={startAdding}
              aria-label="Add clothes"
              className="-mt-7 flex h-16 w-16 items-center justify-center rounded-full bg-accent text-white shadow-lg shadow-accent/30 ring-4 ring-paper transition hover:bg-accent-dark active:scale-95"
            >
              <CameraIcon size={26} />
            </button>
          </div>
          <TabButton active={tab === 'bags'} onClick={() => setTab('bags')} icon={<BagIcon />} label="Bags" />
          <TabButton active={settingsOpen} onClick={() => setSettingsOpen(true)} icon={<SettingsIcon />} label="Settings" />
        </div>
      </nav>

      {adding && <AddItem onClose={() => setAdding(false)} />}
      {settingsOpen && <SettingsSheet onClose={() => setSettingsOpen(false)} />}
    </div>
  )
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`flex h-full flex-col items-center justify-center gap-0.5 text-xs font-medium transition ${
        active ? 'text-ink' : 'text-stone-400 hover:text-stone-600'
      }`}
    >
      {icon}
      {label}
    </button>
  )
}
