import { useAppStore } from './state/useAppStore'

function App() {
  const {isLoading, setLoading} = useAppStore()

  return (
    <>
      <h1>Education Portfolio</h1>
      {isLoading ? <p>Loading...</p> :
      <p>Content Loaded</p>}

    </>
  )
}

export default App
