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
      {/* Opacity only: a transform here would trap the views' fixed-position sheets. */}
      <div key={tab} className="animate-fade">
        {tab === 'wardrobe' ? <WardrobeView onAdd={startAdding} /> : tab === 'outfits' ? <OutfitsView /> : <BagsView />}
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 bg-paper/85 pb-[env(safe-area-inset-bottom)] shadow-bar backdrop-blur-xl backdrop-saturate-150">
        <div className="mx-auto grid h-[68px] max-w-md grid-cols-5 items-center px-1">
          <TabButton active={tab === 'wardrobe'} onClick={() => setTab('wardrobe')} icon={<ShirtIcon />} label="Wardrobe" />
          <TabButton active={tab === 'outfits'} onClick={() => setTab('outfits')} icon={<LayersIcon />} label="Outfits" />
          <div className="flex justify-center">
            <button
              onClick={startAdding}
              aria-label="Add clothes"
              className="-mt-8 flex h-[60px] w-[60px] items-center justify-center rounded-full bg-accent text-white shadow-fab ring-[5px] ring-paper transition duration-200 ease-out hover:-translate-y-0.5 hover:bg-accent-dark active:translate-y-0 active:scale-95"
              style={{ backgroundImage: 'linear-gradient(160deg, rgb(255 255 255 / 0.16), rgb(255 255 255 / 0) 55%)' }}
            >
              <CameraIcon size={24} />
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
      className={`relative flex h-full flex-col items-center justify-center gap-1 text-[11px] font-medium tracking-[0.01em] transition duration-200 ${
        active ? 'text-ink' : 'text-stone-400 hover:text-stone-600'
      }`}
    >
      <span className={`transition duration-300 ease-out ${active ? '-translate-y-px scale-105' : ''}`}>{icon}</span>
      {label}
      {/* Active marker */}
      <span
        aria-hidden="true"
        className={`absolute top-1.5 h-1 w-1 rounded-full bg-accent transition duration-300 ease-out ${active ? 'scale-100 opacity-100' : 'scale-0 opacity-0'}`}
      />
    </button>
  )
}
