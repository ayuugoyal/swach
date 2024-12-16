'use client'

import { useState, useEffect } from 'react'
import { initializeApp } from 'firebase/app'
import { getAuth, signInWithPopup, GoogleAuthProvider, User } from 'firebase/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Loader2, MapPin } from 'lucide-react'
import MapComponent from '@/components/Map'

// Firebase configuration
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

// Interfaces (keep the existing interfaces)
interface EnrichedData {
  sector: string;
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
  condition_of_roads_to_landfills: string;
  coordinates: {
    state_lat: number;
    state_lon: number;
    landfills: Array<{
      lat: number;
      lon: number;
      name: string;
      distance_to_landfill_from_sector?: string;
    }>;
  };
}

interface RouteDetail {
  Route: string;
  'Closeness Coefficient': number;
  Ranking: number;
}

const SECTORS = [
  "Sector 1", "Sector 2", "Sector 3", "Sector 4", "Sector 5",
  "Sector 6", "Sector 7", "Sector 8", "Sector 9", "Sector 10",
  "Sector 11", "Sector 12", "Sector 13", "Sector 14", "Sector 15", "Sector 16"
]

export default function Home() {
  const [user, setUser] = useState<User | null>(null)
  const [phoneNo, setPhoneNo] = useState('')
  const [sector, setSector] = useState('')
  const [enrichedData, setEnrichedData] = useState<EnrichedData | null>(null)
  const [routeDetails, setRouteDetails] = useState<RouteDetail[] | null>(null)
  const [isThereData, setIsThereData] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)
  const [logoutError, setLogoutError] = useState<string | null>(null)
  const [isInformed, setIsInformed] = useState<boolean>(false)
  const [isInputStage, setIsInputStage] = useState<boolean>(false)
  const [userLocation, setUserLocation] = useState<{
    latitude: number | null,
    longitude: number | null
  }>({
    latitude: null,
    longitude: null
  })
  const [locationError, setLocationError] = useState<string | null>(null)

  // New state for dynamic inputs
  const [collectionEfficiency, setCollectionEfficiency] = useState<number>(85)
  const [mileage, setMileage] = useState<number>(10)
  const [petrolLeft, setPetrolLeft] = useState<number>(50)

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setUser(user)
    })


    return () => unsubscribe()
  }, [])

  console.log(routeDetails)

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
      setIsInformed(false)
      setIsInputStage(false)
      await auth.signOut()
    } catch (error) {
      console.error(error)
      setLogoutError('Failed to log out. Please try again.')
    }
  }

  const getUserLocation = () => {
    if ("geolocation" in navigator) {
      setLoading(true)
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          })
          setLocationError(null)
          setLoading(false)
        },
        (error) => {
          setLocationError('Unable to retrieve your location')
          setUserLocation({ latitude: null, longitude: null })
          setLoading(false)
          console.error('Geolocation error:', error)
        }
      )
    } else {
      setLocationError('Geolocation is not supported by your browser')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setLoginError(null)
    setLogoutError(null)
    setEnrichedData(null)

    try {
      const payload = {
        sector: sector,
        collection_efficiency: collectionEfficiency,
        mileage: mileage,
        petrol_left: petrolLeft,
        userLocation: userLocation.latitude && userLocation.longitude
          ? {
            latitude: userLocation.latitude,
            longitude: userLocation.longitude
          }
          : null
      }

      console.log(payload)

      const response = await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/solid-waste-data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch enriched data')
      }

      const data = await response.json()
      console.log(data)
      setEnrichedData(data.data)
      setRouteDetails(data.route_details)
      setIsThereData(true)

    } catch (error) {
      console.log(error)
      setLoginError('An error occurred while fetching enriched data. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleInform = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setLoginError(null)
    setLogoutError(null)

    try {
      if (!phoneNo && !sector) {
        setLoginError('Please enter either a phone number or select a sector')
        setLoading(false)
        return
      }


      setIsInformed(true)
      setIsInputStage(true)
      setLoading(false)

    } catch (error) {
      console.error(error)
      setLoginError('Failed to proceed. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">MCD Chandigarh</CardTitle>
        </CardHeader>
        <CardContent>
          {!user ? (
            <Button onClick={handleLogin} className="w-full">
              Log in with Google
            </Button>
          ) : (
            <>
              {!isInformed ? (
                <div>
                  <form onSubmit={handleInform} className="space-y-4">
                    <div>
                      <label htmlFor="sector" className="block text-sm font-medium text-gray-700">
                        Sector
                      </label>
                      <Select
                        value={sector}
                        onValueChange={setSector}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select the Chandigarh Sector" />
                        </SelectTrigger>
                        <SelectContent>
                          {SECTORS.map((sectorName) => (
                            <SelectItem key={sectorName} value={sectorName}>
                              {sectorName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>or</div>
                    <div>
                      <label htmlFor="phoneno" className="block text-sm font-medium text-gray-700">
                        Phone Number to notify people of that sector
                      </label>
                      <Input
                        id="phoneno"
                        type="text"
                        value={phoneNo}
                        onChange={(e) => setPhoneNo(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Informing...
                        </>
                      ) : (
                        'Inform Them'
                      )}
                    </Button>
                  </form>
                </div>
              ) : isInputStage ? (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label htmlFor="collectionEfficiency" className="block text-sm font-medium text-gray-700">
                      Collection Efficiency (%)
                    </label>
                    <Input
                      id="collectionEfficiency"
                      type="number"
                      value={collectionEfficiency}
                      onChange={(e) => setCollectionEfficiency(Number(e.target.value))}
                      min="0"
                      max="100"
                      className="mt-1"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="mileage" className="block text-sm font-medium text-gray-700">
                      Vehicle Mileage (km/L)
                    </label>
                    <Input
                      id="mileage"
                      type="number"
                      value={mileage}
                      onChange={(e) => setMileage(Number(e.target.value))}
                      min="0"
                      step="0.1"
                      className="mt-1"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="petrolLeft" className="block text-sm font-medium text-gray-700">
                      Petrol Left (%)
                    </label>
                    <Input
                      id="petrolLeft"
                      type="number"
                      value={petrolLeft}
                      onChange={(e) => setPetrolLeft(Number(e.target.value))}
                      min="0"
                      max="100"
                      className="mt-1"
                      required
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={getUserLocation}
                      disabled={loading}
                    >
                      <MapPin className="mr-2 h-4 w-4" />
                      Get My Location
                    </Button>
                    {userLocation.latitude && (
                      <span className="text-sm text-gray-600">
                        Location Found
                      </span>
                    )}
                  </div>
                  {locationError && (
                    <p className="text-red-500 text-sm">{locationError}</p>
                  )}
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Getting...
                      </>
                    ) : (
                      'Get Shortest Path'
                    )}
                  </Button>
                  <Button
                    onClick={() => {
                      setIsInformed(false)
                      setIsInputStage(false)
                    }}
                    variant="outline"
                    className="w-full"
                  >
                    Go Back
                  </Button>
                </form>
              ) : null}

              <Button
                onClick={handleLogout}
                variant="outline"
                className="w-full mt-4"
              >
                Log out
              </Button>
            </>
          )}
          {loginError && <p className="mt-4 text-red-500 text-center">{loginError}</p>}
          {logoutError && <p className="mt-4 text-red-500 text-center">{logoutError}</p>}
        </CardContent>
      </Card>

      {isThereData && enrichedData && (
        <div className="grid sm:grid-cols-2 justify-center items-center">
          <Card className="m-4 max-w-xl">
            <CardHeader>
              <CardTitle className="text-xl">Enriched Data</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-2">
                <div>
                  <dt className="font-semibold">Sector:</dt>
                  <dd>{enrichedData.sector}</dd>
                </div>
                <div>
                  <dt className="font-semibold">Total Waste Generated:</dt>
                  <dd>{enrichedData.total_waste_generated}</dd>
                </div>
                <div>
                  <dt className="font-semibold">Waste Composition:</dt>
                  <dd>
                    Organic: {enrichedData.waste_composition.organic},
                    Plastic: {enrichedData.waste_composition.plastic},
                    Paper: {enrichedData.waste_composition.paper},
                    Metal: {enrichedData.waste_composition.metal},
                    Glass: {enrichedData.waste_composition.glass},
                    Other: {enrichedData.waste_composition.other}
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold">Recycling Rate:</dt>
                  <dd>{enrichedData.recycling_rate}</dd>
                </div>
                <div>
                  <dt className="font-semibold">Waste Management Methods:</dt>
                  <dd>
                    Landfill: {enrichedData.waste_management_methods.landfill},
                    Recycling: {enrichedData.waste_management_methods.recycling},
                    Composting: {enrichedData.waste_management_methods.composting},
                    Incineration: {enrichedData.waste_management_methods.incineration}
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

          <div className="grid grid-rows-2 gap-4">
            <Card className="m-4">
              <CardHeader>
                <CardTitle className="text-xl">Map View</CardTitle>
              </CardHeader>
              <CardContent>
                <MapComponent
                  stateCoordinates={{
                    stateName: enrichedData.sector,
                    lat: enrichedData.coordinates.state_lat,
                    lon: enrichedData.coordinates.state_lon
                  }}
                  landfills={enrichedData.coordinates.landfills}
                />
              </CardContent>
            </Card>

            <Card className="m-4">
              <CardHeader>
                <CardTitle className="text-xl">Route Details</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {routeDetails && routeDetails.map((route, index) => (
                    <li key={index}>
                      <span className="font-semibold">Route:</span> {route.Route}
                      <br />
                      <span className="font-semibold">Ranking:</span> {route.Ranking}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

          </div>
        </div>
      )}
    </div>
  )
}

