'use client'

import React, { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import * as turf from '@turf/turf'

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN!

interface MapComponentProps {
    stateCoordinates: {
        stateName: string
        lat: number; lon: number
    }
    landfills: Array<{ lat: number; lon: number; name: string }>
}

export default function MapComponent({ stateCoordinates, landfills }: MapComponentProps) {
    const mapContainer = useRef(null)
    const map = useRef<mapboxgl.Map | null>(null)
    const [zoom] = useState(10)

    useEffect(() => {
        if (map.current) return // initialize map only once

        map.current = new mapboxgl.Map({
            container: mapContainer.current!,
            style: 'mapbox://styles/mapbox/streets-v11',
            center: [stateCoordinates.lon, stateCoordinates.lat],
            zoom: zoom
        })

        map.current.on('load', () => {
            if (!map.current) return

            // Add navigation control (zoom buttons)
            map.current.addControl(new mapboxgl.NavigationControl(), 'top-right')

            // Add markers for landfills
            landfills.forEach((landfill) => {
                new mapboxgl.Marker()
                    .setLngLat([landfill.lon, landfill.lat])
                    .setPopup(new mapboxgl.Popup().setHTML(`<h3>${landfill.name}</h3>`))
                    .addTo(map.current!)
            })

            // Add marker for state center
            new mapboxgl.Marker({ color: '#FF0000' })
                .setLngLat([stateCoordinates.lon, stateCoordinates.lat])
                .setPopup(new mapboxgl.Popup().setHTML(`<h3>${stateCoordinates.stateName}</h3>`))
                .addTo(map.current)

            // Find nearest landfill and draw line
            const statePoint = turf.point([stateCoordinates.lon, stateCoordinates.lat])
            let nearestLandfill = landfills[0]
            let shortestDistance = Infinity

            landfills.forEach((landfill) => {
                const landfillPoint = turf.point([landfill.lon, landfill.lat])
                const distance = turf.distance(statePoint, landfillPoint, { units: 'kilometers' })
                if (distance < shortestDistance) {
                    shortestDistance = distance
                    nearestLandfill = landfill
                }
            })

            // Add a line layer for the shortest path
            map.current.addSource('shortest-path', {
                type: 'geojson',
                data: {
                    type: 'Feature',
                    properties: {},
                    geometry: {
                        type: 'LineString',
                        coordinates: [
                            [stateCoordinates.lon, stateCoordinates.lat],
                            [nearestLandfill.lon, nearestLandfill.lat]
                        ]
                    }
                }
            })

            map.current.addLayer({
                id: 'shortest-path',
                type: 'line',
                source: 'shortest-path',
                layout: {
                    'line-join': 'round',
                    'line-cap': 'round'
                },
                paint: {
                    'line-color': '#888',
                    'line-width': 3,
                    'line-dasharray': [2, 2]
                }
            })

            // Add popup to show distance
            new mapboxgl.Popup()
                .setLngLat([(stateCoordinates.lon + nearestLandfill.lon) / 2, (stateCoordinates.lat + nearestLandfill.lat) / 2])
                .setHTML(`<h3>Shortest Distance: ${shortestDistance.toFixed(2)} km</h3>`)
                .addTo(map.current)
        })
    }, [stateCoordinates, landfills, zoom])

    return (
        <div ref={mapContainer} className="map-container" style={{ height: '400px', width: '100%' }} />
    )
}