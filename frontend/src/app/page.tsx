'use client'

import { useState, useEffect } from 'react'
import { initializeApp } from 'firebase/app'
import { getAuth, signInWithPopup, GoogleAuthProvider, User } from 'firebase/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'
import MapComponent from '@/components/Map'



const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
}

const app = initializeApp(firebaseConfig)
const auth = getAuth(app)

interface EnrichedData {
  state: string;
  country: string;
  total_waste_generated: string;
  waste_composition: {
    organic: string;
    plastic: string;
    paper: string;
    metal: string;
    glass: string;
    other: string;
  };
  recycling_rate: string;
  waste_management_methods: {
    landfill: string;
    recycling: string;
    composting: string;
    incineration: string;
  };
  key_challenges: string[];
  initiatives: string[];
  data_year: string;
  coordinates: {
    state_lat: number;
    state_lon: number;
    landfills: Array<{
      lat: number;
      lon: number;
      name: string;
    }>;
  };
}


export default function Home() {
  const [user, setUser] = useState<User | null>(null)
  const [state, setState] = useState('')
  const [country, setCountry] = useState('')
  const [enrichedData, setEnrichedData] = useState<EnrichedData | null>(null)
  const [isThereData, setIsThereData] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)
  const [logoutError, setLogoutError] = useState<string | null>(null)

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setUser(user)
    })

    return () => unsubscribe()
  }, [])

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider()
      await signInWithPopup(auth, provider)
    } catch (error) {
      console.error(error)
      setLoginError('Failed to log in. Please try again.')
    }
  }

  const handleLogout = async () => {
    try {
      setIsThereData(false)
      setEnrichedData(null)
      await auth.signOut()
    } catch (error) {
      console.error(error)
      setLogoutError('Failed to log out. Please try again.')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setLoginError(null)
    setLogoutError(null)
    setEnrichedData(null)

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/solid-waste-data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ state, country }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch enriched data')
      }

      const data = await response.json()
      console.log(data)
      setEnrichedData(data)
      setIsThereData(true)

    } catch (error) {
      console.log(error)
      setLoginError('An error occurred while fetching enriched data. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">Solid Waste Data Enrichment</CardTitle>
        </CardHeader>
        <CardContent>
          {!user ? (
            <Button onClick={handleLogin} className="w-full">
              Log in with Google
            </Button>
          ) : (
            <>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="state" className="block text-sm font-medium text-gray-700">
                    State
                  </label>
                  <Input
                    id="state"
                    type="text"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    required
                    className="mt-1"
                  />
                </div>
                <div>
                  <label htmlFor="country" className="block text-sm font-medium text-gray-700">
                    Country
                  </label>
                  <Input
                    id="country"
                    type="text"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    required
                    className="mt-1"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Enriching...
                    </>
                  ) : (
                    'Fetch Data'
                  )}
                </Button>
              </form>
              <Button onClick={handleLogout} variant="outline" className="w-full mt-4">
                Log out
              </Button>
            </>
          )}
          {loginError && <p className="mt-4 text-red-500 text-center">{loginError}</p>}
          {logoutError && <p className="mt-4 text-red-500 text-center">{logoutError}</p>}

        </CardContent>
      </Card>

      {isThereData && enrichedData && (
        <div className="grid grid-cols-2 justify-center items-center">
          <Card className="m-4 max-w-xl">
            <CardHeader>
              <CardTitle className="text-xl">Enriched Data</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-2">
                <div>
                  <dt className="font-semibold">State:</dt>
                  <dd>{enrichedData.state}</dd>
                </div>
                <div>
                  <dt className="font-semibold">Country:</dt>
                  <dd>{enrichedData.country}</dd>
                </div>
                <div>
                  <dt className="font-semibold">Total Waste Generated:</dt>
                  <dd>{enrichedData.total_waste_generated}</dd>
                </div>
                <div>
                  <dt className="font-semibold">Waste Composition:</dt>
                  <dd>
                    Organic: {enrichedData.waste_composition.organic}, Plastic: {enrichedData.waste_composition.plastic}, Paper: {enrichedData.waste_composition.paper}, Metal: {enrichedData.waste_composition.metal}, Glass: {enrichedData.waste_composition.glass}, Other: {enrichedData.waste_composition.other}
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold">Recycling Rate:</dt>
                  <dd>{enrichedData.recycling_rate}</dd>
                </div>
                <div>
                  <dt className="font-semibold">Waste Management Methods:</dt>
                  <dd>
                    Landfill: {enrichedData.waste_management_methods.landfill}, Recycling: {enrichedData.waste_management_methods.recycling}, Composting: {enrichedData.waste_management_methods.composting}, Incineration: {enrichedData.waste_management_methods.incineration}
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold">Key Challenges:</dt>
                  <dd>{enrichedData.key_challenges.join(', ')}</dd>
                </div>
                <div>
                  <dt className="font-semibold">Initiatives:</dt>
                  <dd>{enrichedData.initiatives.join(', ')}</dd>
                </div>
                <div>
                  <dt className="font-semibold">Data Year:</dt>
                  <dd>{enrichedData.data_year}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card className="m-4">
            <CardHeader>
              <CardTitle className="text-xl">Map View</CardTitle>
            </CardHeader>
            <CardContent>
              <MapComponent
                stateCoordinates={{
                  stateName: enrichedData.state,
                  lat: enrichedData.coordinates.state_lat,
                  lon: enrichedData.coordinates.state_lon
                }}
                landfills={enrichedData.coordinates.landfills}
              />
            </CardContent>
          </Card>
        </div>

      )}

    </div>
  )
}
