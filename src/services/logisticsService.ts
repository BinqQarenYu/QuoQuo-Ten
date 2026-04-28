export interface Stop {
  id: string;
  type: 'pickup' | 'delivery';
  location: string;
  lat: number;
  lng: number;
  items: string[];
}

export interface RouteEfficiency {
  totalDistance: string;
  carbonSaved: string;
  batchCount: number;
  optimizedStops: Stop[];
}

/**
 * Simulates the AgriRoute optimization algorithm localized for Pangasinan, Philippines.
 */
export const optimizeDeliveryRoute = (orders: any[]): RouteEfficiency => {
  // Region: Urdaneta City Perimeter (Manaoag, Binalonan, Pozorrubio, Villasis, Asingan)
  
  return {
    totalDistance: "18.4 km",
    carbonSaved: "12.2 kg CO2",
    batchCount: orders.length || 3,
    optimizedStops: [
      { 
        id: '1', 
        type: 'pickup', 
        location: 'Villasis Vegetable Valley', 
        lat: 15.9014, 
        lng: 120.5878, 
        items: ['Sitaw', 'Kalabasa', 'Eggplant'] 
      },
      { 
        id: '2', 
        type: 'pickup', 
        location: 'Binalonan Organic Greens', 
        lat: 16.0494, 
        lng: 120.5901, 
        items: ['Lettuce', 'Calamansi'] 
      },
      { 
        id: '3', 
        type: 'pickup', 
        location: 'Asingan Rice & Grain Hub', 
        lat: 15.9869, 
        lng: 120.6725, 
        items: ['Organic Dinorado', 'Corn'] 
      },
      { 
        id: '4', 
        type: 'delivery', 
        location: 'Client: Urdaneta Central', 
        lat: 15.9758, 
        lng: 120.5669, 
        items: ['Batch A (Vegetables + Rice)'] 
      },
      { 
        id: '5', 
        type: 'delivery', 
        location: 'Client: Manaoag Heritage District', 
        lat: 16.0435, 
        lng: 120.4878, 
        items: ['Batch B (Citrus + Grain)'] 
      },
    ]
  };
};
