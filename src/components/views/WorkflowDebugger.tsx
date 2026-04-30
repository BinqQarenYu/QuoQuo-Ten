import React, { useCallback, useState, useEffect, useRef } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Handle,
  Position,
  NodeProps,
  MarkerType,
  ConnectionMode,
  Panel
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { User } from 'firebase/auth';
import { db, handleFirestoreError } from '../../lib/firebase';
import { collection, doc, setDoc, updateDoc, onSnapshot, serverTimestamp, query, where, deleteDoc } from 'firebase/firestore';
import { Trash2, Edit2, Check } from 'lucide-react';

const defaultViewport = { x: 50, y: 50, zoom: 0.8 };

const cardColors = {
  client: 'emerald',
  rider: 'blue',
  hub: 'indigo',
  provider: 'orange',
  system: 'stone'
};

const CustomNode = ({ data, selected }: NodeProps) => {
  // @ts-ignore
  const colorMode = cardColors[data.role as keyof typeof cardColors] || 'stone';
  const status = data.status || 'pending';
  
  const borderClass = selected ? 'border-indigo-500 shadow-[0_0_0_4px_rgba(99,102,241,0.2)]' : status === 'completed' ? 'border-emerald-500' : status === 'active' ? 'border-indigo-500 ring-4 ring-indigo-500/30 scale-105 z-50 shadow-[4px_10px_0px_0px_rgba(0,0,0,1)]' : 'border-stone-900';
  const bgClass = status === 'completed' ? 'bg-emerald-50' : status === 'active' ? 'bg-indigo-50' : 'bg-white';
  
  return (
    <div className={`${bgClass} border-2 ${borderClass} rounded-xl p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] w-80 transition-all duration-300 hover:-translate-y-1 hover:shadow-[4px_6px_0px_0px_rgba(0,0,0,1)]`}>
      <div className={`text-[10px] font-black uppercase tracking-wider mb-2 text-${colorMode}-600`}>
        {data.role as string}
      </div>
      <h3 className="font-bold text-lg leading-tight mb-2 text-stone-900">{data.title as string}</h3>
      <p className="text-sm text-stone-600 leading-snug">{data.description as string}</p>
      
      {/* Payload Visualization */}
      {(data.input || data.output) && (
        <div className="mt-4 text-xs flex flex-col gap-2 border-t-2 border-stone-200 pt-3">
           {data.input && (
              <div className="bg-stone-50 p-2 rounded-lg border border-stone-200">
                <span className="font-bold text-[9px] uppercase tracking-widest text-stone-500 mb-1 block">Input Payload</span>
                <pre className="text-stone-700 font-mono text-[10px] overflow-x-auto whitespace-pre-wrap leading-tight">{JSON.stringify(data.input, null, 2)}</pre>
              </div>
           )}
           {data.output && (status === 'completed' || status === 'active') && (
              <div className={`p-2 rounded-lg border ${status === 'completed' ? 'bg-indigo-50 border-indigo-200' : 'bg-stone-50 border-stone-200 opacity-50'}`}>
                <span className={`font-bold text-[9px] uppercase tracking-widest mb-1 block ${status === 'completed' ? 'text-indigo-600' : 'text-stone-500'}`}>Output Payload</span>
                <pre className={`font-mono text-[10px] overflow-x-auto whitespace-pre-wrap leading-tight ${status === 'completed' ? 'text-indigo-900' : 'text-stone-500'}`}>{status === 'completed' ? JSON.stringify(data.output, null, 2) : 'Awaiting computation...'}</pre>
              </div>
           )}
        </div>
      )}
      
      {status === 'active' && (
         <div className="mt-3 flex items-center gap-2 text-indigo-600 text-[10px] font-bold uppercase tracking-widest">
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
            Processing...
         </div>
      )}
      {status === 'completed' && (
         <div className="mt-3 flex items-center gap-2 text-emerald-600 text-[10px] font-bold uppercase tracking-widest">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
            Done
         </div>
      )}
      
      <Handle type="target" position={Position.Left} className="w-4 h-4 rounded-full border-2 border-stone-900 bg-white hover:bg-indigo-100 hover:border-indigo-500 transition-colors" />
      <Handle type="source" position={Position.Right} className="w-4 h-4 rounded-full border-2 border-stone-900 bg-stone-900 hover:bg-indigo-500 hover:border-indigo-900 transition-colors" />
    </div>
  );
};

const nodeTypes = {
  customTask: CustomNode,
};

const initialNodes = [
  {
    id: '1',
    type: 'customTask',
    position: { x: 0, y: 150 },
    data: { step: 1, status: 'pending', role: 'client', title: 'Buy Menu', description: 'Customer browses the Kitchen catalog and initiates a purchase of a meal kit.' }
  },
  {
    id: '2',
    type: 'customTask',
    position: { x: 350, y: 150 },
    data: { step: 2, status: 'pending', role: 'client', title: 'Review Order', description: 'Customer reviews the list of ingredients required from various providers.' }
  },
  {
    id: '3',
    type: 'customTask',
    position: { x: 700, y: 150 },
    data: { step: 3, status: 'pending', role: 'client', title: 'Checkout & Pay', description: 'Customer confirms the delivery address and chooses Cash on Delivery (COD).' }
  },
  {
    id: '4',
    type: 'customTask',
    position: { x: 1050, y: 150 },
    data: { step: 4, status: 'pending', role: 'system', title: 'Hub Order Processing', description: 'The Hub automatically breaks down the order into tasks for Riders and Providers.' }
  },
  {
    id: '5a',
    type: 'customTask',
    position: { x: 1400, y: 0 },
    data: { step: 5, status: 'pending', role: 'provider', title: 'Provider Prep', description: 'Farmers and Commissary start preparing the individual raw ingredients.' }
  },
  {
    id: '5b',
    type: 'customTask',
    position: { x: 1400, y: 300 },
    data: { step: 5, status: 'pending', role: 'rider', title: 'Rider Assignment', description: 'A Rider accepts the batch delivery and sees the pickup locations.' }
  },
  {
    id: '6',
    type: 'customTask',
    position: { x: 1750, y: 150 },
    data: { step: 6, status: 'pending', role: 'rider', title: 'Pickup Loop', description: 'Rider picks up the ingredients from Farmers and the main Commissary.' }
  },
  {
    id: '7',
    type: 'customTask',
    position: { x: 2100, y: 150 },
    data: { step: 7, status: 'pending', role: 'rider', title: 'Order Fulfilled', description: 'Rider arrives at the Customer and gets paid via COD.' }
  },
  {
    id: '8a',
    type: 'customTask',
    position: { x: 2450, y: 0 },
    data: { step: 8, status: 'pending', role: 'rider', title: 'Rider Retains Share', description: 'Rider keeps the delivery fee portion out of the COD payment.', input: { codCollected: 1450, expectedDeliveryFee: 150 }, output: { retainedAmount: 150, remittanceDue: 1300 } }
  },
  {
    id: '8b',
    type: 'customTask',
    position: { x: 2450, y: 300 },
    data: { step: 8, status: 'pending', role: 'hub', title: 'Management Remittance', description: 'Rider sends the rest of the payment to the Management (Hub).', input: { remittanceDue: 1300 }, output: { remittedAmount: 1300, hubReceived: true, transactionId: "rem_7788" } }
  },
  {
    id: '9',
    type: 'customTask',
    position: { x: 2800, y: 150 },
    data: { step: 9, status: 'pending', role: 'hub', title: 'Provider Payouts', description: 'Management forwards the respective shares to Farmers, Food Stalls, and groceries.', input: { totalRemitted: 1300, providers: [{ id: "farm_1", amount: 480 }, { id: "commissary_1", amount: 620 }] }, output: { hubRetainedRevenue: 200, payoutsInitiated: 2, batchStatus: "closed" } }
  },
  {
    id: '10',
    type: 'customTask',
    position: { x: 3150, y: 150 },
    data: { step: 10, status: 'pending', role: 'system', title: 'Workflow End', description: 'All payouts reconciled. Workflow completed successfully.' }
  }
];

const defaultEdgeOptions = {
  type: 'smoothstep',
  animated: true,
  style: { stroke: '#1c1917', strokeWidth: 2 },
  markerEnd: {
    type: MarkerType.ArrowClosed,
    color: '#1c1917',
  },
};

const initialEdges = [
  { id: 'e1-2', source: '1', target: '2', ...defaultEdgeOptions },
  { id: 'e2-3', source: '2', target: '3', ...defaultEdgeOptions },
  { id: 'e3-4', source: '3', target: '4', ...defaultEdgeOptions },
  { id: 'e4-5a', source: '4', target: '5a', ...defaultEdgeOptions },
  { id: 'e4-5b', source: '4', target: '5b', ...defaultEdgeOptions },
  { id: 'e5a-6', source: '5a', target: '6', ...defaultEdgeOptions },
  { id: 'e5b-6', source: '5b', target: '6', ...defaultEdgeOptions },
  { id: 'e6-7', source: '6', target: '7', ...defaultEdgeOptions },
  { id: 'e7-8a', source: '7', target: '8a', ...defaultEdgeOptions },
  { id: 'e7-8b', source: '7', target: '8b', ...defaultEdgeOptions },
  { id: 'e8b-9', source: '8b', target: '9', ...defaultEdgeOptions },
  { id: 'e9-10', source: '9', target: '10', ...defaultEdgeOptions },
];

const riderNodes = [
  { id: '1', type: 'customTask', position: { x: 0, y: 150 }, data: { step: 1, status: 'pending', role: 'system', title: 'Job Offer', description: 'System sends a batch order request to the nearest available Rider.' } },
  { id: '2', type: 'customTask', position: { x: 350, y: 150 }, data: { step: 2, status: 'pending', role: 'rider', title: 'Accept Job', description: 'Rider accepts the delivery batch and locks in the task.' } },
  { id: '3', type: 'customTask', position: { x: 700, y: 150 }, data: { step: 3, status: 'pending', role: 'system', title: 'Route Optimization', description: 'System recalculates and guides the Rider to the first pickup location.' } },
  { id: '4', type: 'customTask', position: { x: 1050, y: 0 }, data: { step: 4, status: 'pending', role: 'rider', title: 'Pickup: Farm', description: 'Rider arrives at the Farm to pick up fresh produce.' } },
  { id: '5', type: 'customTask', position: { x: 1400, y: 0 }, data: { step: 5, status: 'pending', role: 'rider', title: 'Pickup: Commissary', description: 'Rider arrives at the Commissary to pick up cooked meals.' } },
  { id: '6', type: 'customTask', position: { x: 1750, y: 150 }, data: { step: 6, status: 'pending', role: 'rider', title: 'In Transit to Customer', description: 'Rider proceeds to the customer delivery address.' } },
  { id: '7', type: 'customTask', position: { x: 2100, y: 150 }, data: { step: 7, status: 'pending', role: 'rider', title: 'Delivery & COD', description: 'Rider hands over the items and collects cash.' } },
  { id: '8', type: 'customTask', position: { x: 2450, y: 150 }, data: { step: 8, status: 'pending', role: 'rider', title: 'Income Retention', description: 'Rider keeps their delivery fee directly from the COD collected.' } },
  { id: '9', type: 'customTask', position: { x: 2800, y: 150 }, data: { step: 9, status: 'pending', role: 'rider', title: 'Hub Remittance', description: 'Rider drops off the remaining cash to the Hub/Management.' } },
  { id: '10', type: 'customTask', position: { x: 3150, y: 150 }, data: { step: 10, status: 'pending', role: 'system', title: 'Shift Complete', description: 'Batch successfully closed. Rider is available for the next job.' } }
];

const riderEdges = [
  { id: 'e1-2', source: '1', target: '2', ...defaultEdgeOptions },
  { id: 'e2-3', source: '2', target: '3', ...defaultEdgeOptions },
  { id: 'e3-4', source: '3', target: '4', ...defaultEdgeOptions },
  { id: 'e4-5', source: '4', target: '5', ...defaultEdgeOptions },
  { id: 'e5-6', source: '5', target: '6', ...defaultEdgeOptions },
  { id: 'e6-7', source: '6', target: '7', ...defaultEdgeOptions },
  { id: 'e7-8', source: '7', target: '8', ...defaultEdgeOptions },
  { id: 'e8-9', source: '8', target: '9', ...defaultEdgeOptions },
  { id: 'e9-10', source: '9', target: '10', ...defaultEdgeOptions },
];

const managementNodes = [
  { id: '1', type: 'customTask', position: { x: 0, y: 150 }, data: { step: 1, status: 'pending', role: 'system', title: 'Order Ingestion', description: 'System aggregates incoming batch requests from multiple sources.', input: { apiSource: "customer_app", pendingOrders: 42, priority: "high" }, output: { batchedOrders: 8, ingestionId: "ing_90210" } } },
  { id: '2', type: 'customTask', position: { x: 350, y: 150 }, data: { step: 2, status: 'pending', role: 'admin', title: 'Route Generation', description: 'System groups orders into batches and dispatches to optimal riders.', input: { ingestionId: "ing_90210", availableRiders: 15 }, output: { routeId: "rt_888", assignedRiderId: "rid_42", ETA: "45 mins" } } },
  { id: '3', type: 'customTask', position: { x: 700, y: 150 }, data: { step: 3, status: 'pending', role: 'admin', title: 'Fleet Tracking', description: 'Live monitoring of overall fleet metrics and individual Rider GPS.', input: { routeId: "rt_888", gpsPingFreq: "5s" }, output: { lastLocation: [14.5995, 120.9842], delay: "none" } } },
  { id: '4', type: 'customTask', position: { x: 1050, y: 150 }, data: { step: 4, status: 'pending', role: 'admin', title: 'Manual Exception Handling', description: 'Admin console allows overrides for delayed/failed deliveries or unassigned orders.', input: { delayAlerts: 0, trafficCondition: "moderate" }, output: { overridingNeeded: false, systemAction: "continue" } } },
  { id: '5', type: 'customTask', position: { x: 1400, y: 150 }, data: { step: 5, status: 'pending', role: 'system', title: 'Delivery Confirmation Auth', description: 'System verifies COD drop-off and logs digital signatures.', input: { assignedRiderId: "rid_42", dropOff: true }, output: { authStatus: "verified", eSignatureHash: "0xabc123" } } },
  { id: '6', type: 'customTask', position: { x: 1750, y: 150 }, data: { step: 6, status: 'pending', role: 'admin', title: 'Remittance Verification', description: 'Reconciling rider cash remitted at hub against digital order footprint.', input: { expectedCOD: 1450, riderRemitted: 1450 }, output: { remittanceStatus: "cleared", variance: 0 } } },
  { id: '7', type: 'customTask', position: { x: 2100, y: 0 }, data: { step: 7, status: 'pending', role: 'admin', title: 'Provider Payouts', description: 'System calculates and queues payments to farmers and commissaries based on completed deliveries.', input: { completedDeliveries: 12, totalSales: 1450, processedOrders: [{ orderId: "ord_101", amount: 120, farm: "Green Valley" }, { orderId: "ord_102", amount: 380, farm: "Sunrise Farms" }] }, output: { amount: 950, payoutStatus: "queued", transactionId: "txn_892144" } } },
  { id: '8', type: 'customTask', position: { x: 2450, y: 0 }, data: { step: 8, status: 'pending', role: 'admin', title: 'Rider Fee Resolution', description: 'System logs rider direct income cut for tracking and tax purposes.', input: { riderEarned: 300, taxWithheld: 15 }, output: { riderCredit: 285, taxLogged: true } } },
  { id: '9', type: 'customTask', position: { x: 2800, y: 150 }, data: { step: 9, status: 'pending', role: 'system', title: 'Batch Closure & Analytics', description: 'Financial bookkeeping, order locking, and updating management dashboards.', input: { routeId: "rt_888", allCleared: true }, output: { batchClosed: true, profitMargin: "18.6%" } } }
];

const managementEdges = [
  { id: 'e1-2', source: '1', target: '2', ...defaultEdgeOptions },
  { id: 'e2-3', source: '2', target: '3', ...defaultEdgeOptions },
  { id: 'e3-4', source: '3', target: '4', ...defaultEdgeOptions },
  { id: 'e4-5', source: '4', target: '5', ...defaultEdgeOptions },
  { id: 'e5-6', source: '5', target: '6', ...defaultEdgeOptions },
  { id: 'e6-7', source: '6', target: '7', ...defaultEdgeOptions },
  { id: 'e7-8', source: '7', target: '8', ...defaultEdgeOptions },
  { id: 'e8-9', source: '8', target: '9', ...defaultEdgeOptions }
];

const providerNodes = [
  { id: '1', type: 'customTask', position: { x: 0, y: 150 }, data: { step: 1, status: 'pending', role: 'provider', title: 'Order Received', description: 'Provider receives digital order notification for fresh produce/meals.' } },
  { id: '2', type: 'customTask', position: { x: 350, y: 150 }, data: { step: 2, status: 'pending', role: 'provider', title: 'Inventory Check', description: 'Staff verifies stock levels and starts gathering items.' } },
  { id: '3', type: 'customTask', position: { x: 700, y: 150 }, data: { step: 3, status: 'pending', role: 'provider', title: 'Packing & QA', description: 'Items are packaged, labeled, and undergo quality assurance checks.' } },
  { id: '4', type: 'customTask', position: { x: 1050, y: 150 }, data: { step: 4, status: 'pending', role: 'provider', title: 'Dispatch Prep', description: 'Order staged in the holding area awaiting Rider arrival.' } },
  { id: '5', type: 'customTask', position: { x: 1400, y: 150 }, data: { step: 5, status: 'pending', role: 'provider', title: 'Handover to Rider', description: 'Identity verification and physical handover of goods to assigned Rider.' } },
  { id: '6', type: 'customTask', position: { x: 1750, y: 150 }, data: { step: 6, status: 'pending', role: 'system', title: 'System Settlement', description: 'Digital confirmation that order has left the premises, triggering Payout queue.' } },
  { id: '7', type: 'customTask', position: { x: 2100, y: 150 }, data: { step: 7, status: 'pending', role: 'provider', title: 'Receive Payout', description: 'Funds received in provider wallet minus platform commissions.' } }
];

const providerEdges = [
  { id: 'e1-2', source: '1', target: '2', ...defaultEdgeOptions },
  { id: 'e2-3', source: '2', target: '3', ...defaultEdgeOptions },
  { id: 'e3-4', source: '3', target: '4', ...defaultEdgeOptions },
  { id: 'e4-5', source: '4', target: '5', ...defaultEdgeOptions },
  { id: 'e5-6', source: '5', target: '6', ...defaultEdgeOptions },
  { id: 'e6-7', source: '6', target: '7', ...defaultEdgeOptions }
];

const workflowsConfig = {
  customer: {
    name: 'Customer E2E Workflow',
    nodes: initialNodes,
    edges: initialEdges,
    steps: [
      { wait: 2000, step: 2, status: 'pending' },
      { wait: 2000, step: 3, status: 'pending' },
      { wait: 3000, step: 4, status: 'processing' },
      { wait: 3500, step: 5, status: 'processing' },
      { wait: 3000, step: 6, status: 'shipped' },
      { wait: 4000, step: 7, status: 'delivered', paymentStatus: 'paid' },
      { wait: 2500, step: 8, status: 'delivered' },
      { wait: 2500, step: 9, status: 'delivered' },
      { wait: 2000, step: 10, status: 'completed' },
      { wait: 2000, step: 11, status: 'completed' }, // To end it
    ]
  },
  rider: {
    name: 'Rider Job Workflow',
    nodes: riderNodes,
    edges: riderEdges,
    steps: [
      { wait: 1500, step: 2, status: 'pending' },
      { wait: 2000, step: 3, status: 'processing' },
      { wait: 3000, step: 4, status: 'processing' },
      { wait: 3000, step: 5, status: 'processing' },
      { wait: 3500, step: 6, status: 'shipped' },
      { wait: 4000, step: 7, status: 'delivered', paymentStatus: 'paid' },
      { wait: 2000, step: 8, status: 'delivered' },
      { wait: 2500, step: 9, status: 'delivered' },
      { wait: 2000, step: 10, status: 'completed' },
      { wait: 2000, step: 11, status: 'completed' },
    ]
  },
  management: {
    name: 'Management Workflow',
    nodes: managementNodes,
    edges: managementEdges,
    steps: [
      { wait: 1500, step: 2, status: 'processing' },
      { wait: 2500, step: 3, status: 'processing' },
      { wait: 3000, step: 4, status: 'processing' },
      { wait: 2500, step: 5, status: 'processing' },
      { wait: 3500, step: 6, status: 'delivered', paymentStatus: 'paid' },
      { wait: 3000, step: 7, status: 'delivered' },
      { wait: 2000, step: 8, status: 'delivered' },
      { wait: 2000, step: 9, status: 'completed' },
      { wait: 2000, step: 10, status: 'completed' },
    ]
  },
  provider: {
    name: 'Provider Workflow',
    nodes: providerNodes,
    edges: providerEdges,
    steps: [
      { wait: 1500, step: 2, status: 'processing' },
      { wait: 2000, step: 3, status: 'processing' },
      { wait: 2500, step: 4, status: 'processing' },
      { wait: 3000, step: 5, status: 'shipped' },
      { wait: 4000, step: 6, status: 'delivered' },
      { wait: 3000, step: 7, status: 'completed' },
      { wait: 2000, step: 8, status: 'completed' },
    ]
  }
};

export default function WorkflowDebugger({ user }: { user: User }) {
  const [activeWorkflowKey, setActiveWorkflowKey] = useState<keyof typeof workflowsConfig>('customer');
  const [nodes, setNodes, onNodesChange] = useNodesState(workflowsConfig.customer.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(workflowsConfig.customer.edges);
  const [simulationRunning, setSimulationRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [activeTxId, setActiveTxId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  const isRunningRef = useRef(false);
  const isPausedRef = useRef(false);

  const [audits, setAudits] = useState<any[]>([]);
  const [editingAuditId, setEditingAuditId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'workflow_audits'), where('clientId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const auditsData = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) }));
      auditsData.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
      setAudits(auditsData);
    }, (error) => {
      handleFirestoreError(error, 'list', 'workflow_audits');
    });
    return () => unsubscribe();
  }, [user.uid]);

  const deleteAudit = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'workflow_audits', id));
      try { await deleteDoc(doc(db, 'transactions', id)); } catch(e) {}
      if (activeTxId === id) {
        resetLayout();
      }
    } catch (e) {
      handleFirestoreError(e, 'delete', `workflow_audits/${id}`);
    }
  };

  const renameAudit = async (id: string, newName: string) => {
    try {
      await updateDoc(doc(db, 'workflow_audits', id), {
        name: newName,
        updatedAt: serverTimestamp()
      });
      setEditingAuditId(null);
    } catch (e) {
      handleFirestoreError(e, 'update', `workflow_audits/${id}`);
    }
  };

  const handleSaveWorkflow = async () => {
    try {
      setSaveStatus('saving');
      if (activeTxId) {
        await updateDoc(doc(db, 'workflow_audits', activeTxId), {
          updatedAt: serverTimestamp()
        });
      } else {
        const txId = 'sim_' + Date.now().toString();
        await setDoc(doc(db, 'workflow_audits', txId), {
          clientId: user.uid,
          name: `${workflowsConfig[activeWorkflowKey].name.split(' ')[0]} Sim (Manual)`,
          status: 'pending',
          workflowType: activeWorkflowKey,
          workflowStep: 1,
          totalAmount: 1450,
          paymentStatus: 'unpaid',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        setActiveTxId(txId);
      }
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (e) {
      handleFirestoreError(e, activeTxId ? 'update' : 'write', 'workflow_audits');
      setSaveStatus('idle');
    }
  };

  const onConnect = useCallback((params: any) => setEdges((eds) => addEdge({ ...params, ...defaultEdgeOptions }, eds)), [setEdges]);

  const resetLayout = useCallback((wfKey: keyof typeof workflowsConfig = activeWorkflowKey) => {
    setActiveWorkflowKey(wfKey);
    setNodes(workflowsConfig[wfKey].nodes);
    setEdges(workflowsConfig[wfKey].edges);
    setSimulationRunning(false);
    setIsPaused(false);
    isRunningRef.current = false;
    isPausedRef.current = false;
    setActiveTxId(null);
  }, [activeWorkflowKey, setNodes, setEdges]);

  useEffect(() => {
    if (!activeTxId) return;
    
    const unsubscribe = onSnapshot(doc(db, 'workflow_audits', activeTxId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const currentStep = data.workflowStep || 0;
        
        const wfType = (data.workflowType as keyof typeof workflowsConfig) || 'customer';
        if (wfType !== activeWorkflowKey) {
          setActiveWorkflowKey(wfType);
        }
        
        setNodes((nds) => 
          nds.map((node) => {
            const stepGroup = (node.data as any).step;
            if (stepGroup < currentStep) {
              return { ...node, data: { ...node.data, status: 'completed' } };
            } else if (stepGroup === currentStep) {
              return { ...node, data: { ...node.data, status: 'active' } };
            } else {
              return { ...node, data: { ...node.data, status: 'pending' } };
            }
          })
        );
        
        setEdges((eds) => 
           eds.map((edge) => {
              const sourceNode = nodes.find(n => n.id === edge.source);
              const targetNode = nodes.find(n => n.id === edge.target);
              const sourceStep = (sourceNode?.data as any)?.step || 0;
              const targetStep = (targetNode?.data as any)?.step || 0;
              
              // If the step is fully completed, color the edge path
              const isCompleted = sourceStep < currentStep && targetStep < currentStep;
              const isActive = sourceStep < currentStep && targetStep === currentStep;
              
              const strokeColor = isActive ? '#4f46e5' : isCompleted ? '#10b981' : '#1c1917';
              
              return {
                 ...edge,
                 style: { stroke: strokeColor, strokeWidth: isCompleted || isActive ? 3 : 2 },
                 markerEnd: {
                   type: MarkerType.ArrowClosed,
                   color: strokeColor,
                 },
                 animated: (!isCompleted && sourceStep <= currentStep) || isActive
              };
           })
        );
        
        if (currentStep > 10) {
           setSimulationRunning(false);
           isRunningRef.current = false;
        }
      }
    }, (error) => {
      handleFirestoreError(error, 'get', `workflow_audits/${activeTxId}`);
    });
    
    return () => unsubscribe();
  }, [activeTxId, setNodes, setEdges, nodes]);

  const togglePause = () => {
    setIsPaused(prev => {
      isPausedRef.current = !prev;
      return !prev;
    });
  };

  const runSimulation = async () => {
    if (simulationRunning) return;
    setSimulationRunning(true);
    isRunningRef.current = true;
    setIsPaused(false);
    isPausedRef.current = false;
    
    // Reset nodes visually before start
    setNodes(workflowsConfig[activeWorkflowKey].nodes);
    setEdges(workflowsConfig[activeWorkflowKey].edges);
    
    try {
      const txId = 'sim_' + Date.now().toString();
      setActiveTxId(txId);
      
      const now = serverTimestamp();
      // Step 1: Init document in Firestore
      await setDoc(doc(db, 'workflow_audits', txId), {
        clientId: user.uid,
        name: `${workflowsConfig[activeWorkflowKey].name.split(' ')[0]} Sim ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
        status: 'pending',
        workflowType: activeWorkflowKey,
        workflowStep: 1,
        totalAmount: 1450,
        paymentStatus: 'unpaid',
        items: [{ recipeId: 'sim_recipe_1', quantity: 1 }],
        createdAt: now,
        updatedAt: now
      });

      // Synchronize with an actual transaction to see it in other views securely
      await setDoc(doc(db, 'transactions', txId), {
        clientId: user.uid,
        status: 'pending',
        type: 'meal_kit',
        recipes: [{ title: 'Simulated Order (Workflow Debugger)', servings: 2 }],
        items: [{
          name: "Organic Tomatoes",
          quantity: "500g",
          farm: "Sunrise Farms",
          source: { type: "farm", id: "farm_1", farmerName: "Mang Cardo" },
          category: "vegetables"
        },
        {
          name: "Free-range Chicken",
          quantity: "1kg",
          farm: "Green Valley",
          source: { type: "commissary", id: "comm_1" },
          category: "meat"
        }],
        totalAmount: 1450,
        paymentStatus: 'unpaid',
        deliveryAddress: '123 Fake Street (Sim)',
        lat: 15.9758 + (Math.random() * 0.04 - 0.02),
        lng: 120.5707 + (Math.random() * 0.04 - 0.02),
        createdAt: now,
        updatedAt: now
      });
      
      // Simulated timeline of the backend processing
      const steps = workflowsConfig[activeWorkflowKey].steps;

      for (const s of steps) {
        let timeWaited = 0;
        const tick = 100;
        while (timeWaited < s.wait) {
          if (!isRunningRef.current) return;
          if (!isPausedRef.current) {
            timeWaited += tick;
          }
          await new Promise(res => setTimeout(res, tick));
        }

        if (!isRunningRef.current) return;

        // Find the node that just completed (usually s.step - 1)
        const previousStepNode = workflowsConfig[activeWorkflowKey].nodes.find((n: any) => n.data.step === s.step - 1);
        const payloadLog = previousStepNode ? {
          stepTitle: previousStepNode.data.title,
          input: previousStepNode.data.input || null,
          output: previousStepNode.data.output || null
        } : null;

        await updateDoc(doc(db, 'workflow_audits', txId), {
          workflowStep: s.step,
          status: s.status,
          updatedAt: serverTimestamp(),
          ...(s.paymentStatus ? { paymentStatus: s.paymentStatus } : {}),
          ...(payloadLog ? { [`logs_step_${s.step - 1}`]: payloadLog } : {})
        });

        // Also update the matching transaction document
        try {
          await updateDoc(doc(db, 'transactions', txId), {
            status: s.status,
            updatedAt: serverTimestamp(),
            ...(s.paymentStatus ? { paymentStatus: s.paymentStatus } : {})
          });
        } catch(e) {
            console.error("Failed to update transaction sync:", e);
        }
      }
      
    } catch (e) {
      console.error(e);
      setSimulationRunning(false);
      isRunningRef.current = false;
    }
  };

  return (
    <div className="flex gap-6 w-full h-[700px]">
      <div className="w-64 shrink-0 h-full bg-white border-2 border-stone-900 rounded-2xl p-4 flex flex-col shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <h3 className="font-black uppercase border-b-2 border-stone-100 pb-2 mb-4">Saved Workflows</h3>
        <div className="flex-grow overflow-y-auto flex flex-col gap-2">
           {audits.map(audit => (
             <div 
               key={audit.id} 
               className={`p-3 border-2 rounded-xl flex flex-col gap-2 cursor-pointer transition-colors ${activeTxId === audit.id ? 'border-indigo-500 bg-indigo-50' : 'border-stone-200 hover:border-stone-900 bg-white'}`} 
               onClick={() => {
                 const wfType = (audit.workflowType as keyof typeof workflowsConfig) || 'customer';
                 if (wfType !== activeWorkflowKey) {
                   setActiveWorkflowKey(wfType);
                   setNodes(workflowsConfig[wfType].nodes);
                   setEdges(workflowsConfig[wfType].edges);
                 }
                 setActiveTxId(audit.id);
               }}
             >
                <div className="flex justify-between items-start w-full">
                   <div className="flex flex-col flex-grow">
                      {editingAuditId === audit.id ? (
                        <div className="flex items-center gap-1 w-full" onClick={e => e.stopPropagation()}>
                          <input 
                            type="text" 
                            value={editingName} 
                            onChange={(e) => setEditingName(e.target.value)}
                            onKeyDown={(e) => {
                               if (e.key === 'Enter') renameAudit(audit.id, editingName);
                            }}
                            autoFocus
                            className="text-xs font-bold font-sans text-stone-900 mb-1 leading-none border-b-2 border-indigo-500 bg-indigo-50/50 focus:outline-none w-full py-1 px-1"
                          />
                          <button onClick={() => renameAudit(audit.id, editingName)} className="text-emerald-500 hover:text-emerald-600 p-1 bg-white rounded shadow border border-emerald-100">
                             <Check size={12} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 group w-full pt-1">
                           <span className="text-xs font-bold font-sans text-stone-900 mb-1 leading-none truncate max-w-[120px]">{audit.name || `Sim ${audit.id.substring(4, 9)}...`}</span>
                           <button 
                             onClick={(e) => { 
                               e.stopPropagation(); 
                               setEditingAuditId(audit.id); 
                               setEditingName(audit.name || ''); 
                             }} 
                             className="text-stone-300 hover:text-indigo-500 opacity-0 group-hover:opacity-100 transition-all"
                           >
                              <Edit2 size={12} />
                           </button>
                        </div>
                      )}
                      <span className="text-[9px] uppercase font-bold text-stone-400 mt-1">ID: {audit.id.split('_')[1] || audit.id}</span>
                   </div>
                   <button 
                     onClick={(e) => { e.stopPropagation(); deleteAudit(audit.id); }} 
                     className="text-stone-400 hover:text-red-500 transition-colors p-1"
                   >
                      <Trash2 size={14} />
                   </button>
                </div>
                <div className="flex justify-between items-center text-[10px] uppercase font-bold tracking-widest mt-1">
                   <span className={`${audit.status === 'completed' ? 'text-emerald-600' : 'text-orange-500'}`}>{audit.status}</span>
                   <span className="text-stone-400">{audit.createdAt ? new Date(audit.createdAt.toMillis()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                </div>
             </div>
           ))}
           {audits.length === 0 && <div className="text-xs font-bold text-stone-400 text-center mt-4">No saved workflows</div>}
        </div>
      </div>
      
      <div className="flex-grow h-full border-2 border-stone-900 rounded-2xl overflow-hidden bg-stone-50 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col relative">
      <div className="p-4 border-b-2 border-stone-900 bg-white flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 z-10 w-full shrink-0">
        <div>
          <h2 className="text-xl font-black uppercase">Workflow Debugger</h2>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {(Object.keys(workflowsConfig) as Array<keyof typeof workflowsConfig>).map(key => (
              <button
                key={key}
                onClick={() => resetLayout(key)}
                className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full border-2 transition-colors ${activeWorkflowKey === key ? 'bg-stone-900 text-white border-stone-900' : 'bg-white text-stone-500 border-stone-200 hover:border-stone-900'}`}
              >
                {workflowsConfig[key].name}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:gap-4">
           {activeTxId && (
              <div className="text-[10px] font-bold text-stone-500 bg-stone-100 px-3 py-1 rounded-full border-2 border-stone-200 uppercase">
                 Doc ID: {activeTxId}
              </div>
           )}
           {simulationRunning && (
              <button 
                onClick={togglePause}
                className={`px-4 py-2 rounded-xl text-sm font-bold uppercase tracking-wider border-2 border-stone-900 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all ${isPaused ? 'bg-amber-400 text-stone-900 hover:bg-amber-300 hover:shadow-none hover:translate-y-[2px] hover:translate-x-[2px]' : 'bg-white text-stone-900 hover:bg-stone-100 hover:shadow-none hover:translate-y-[2px] hover:translate-x-[2px]'}`}
              >
                {isPaused ? 'Resume' : 'Pause'}
              </button>
           )}
           <button 
             onClick={handleSaveWorkflow}
             disabled={saveStatus === 'saving' || (saveStatus === 'saved')}
             className={`px-4 py-2 rounded-xl text-sm font-bold uppercase tracking-wider border-2 border-stone-900 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all ${saveStatus === 'saved' ? 'bg-indigo-300 text-stone-900 shadow-none translate-x-[2px] translate-y-[2px]' : 'bg-white text-stone-900 hover:bg-stone-100 hover:shadow-none hover:translate-y-[2px] hover:translate-x-[2px]'}`}
           >
             {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved!' : 'Save'}
           </button>
           <button 
             onClick={runSimulation}
             disabled={simulationRunning}
             className={`px-4 py-2 rounded-xl text-sm font-bold uppercase tracking-wider border-2 border-stone-900 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all ${simulationRunning ? 'bg-stone-200 text-stone-500' : 'bg-emerald-600 text-white hover:bg-emerald-500 hover:shadow-none hover:translate-y-[2px] hover:translate-x-[2px]'}`}
           >
             {simulationRunning ? 'Simulation Running...' : 'Run Live Simulation'}
           </button>
        </div>
      </div>
      <div className="flex-grow w-full h-full relative cursor-grab active:cursor-grabbing">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          defaultEdgeOptions={defaultEdgeOptions}
          connectionMode={ConnectionMode.Loose}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.2}
          maxZoom={2}
          className="bg-stone-50 h-full w-full"
        >
          <Panel position="top-right" className="bg-white border-2 border-stone-900 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] rounded-xl p-2 flex gap-2">
            <button 
               onClick={() => resetLayout(activeWorkflowKey)}
               className="px-3 py-1 text-[10px] font-bold uppercase hover:bg-stone-100 rounded-lg transition-colors border border-transparent hover:border-stone-200"
            >
               Reset Flow
            </button>
          </Panel>
          <Controls className="bg-white border-2 border-stone-900 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] rounded-xl overflow-hidden" />
          <MiniMap 
            nodeColor={(node) => {
              switch ((node.data as any).role) {
                case 'client': return '#10b981'; // emerald
                case 'rider': return '#2563eb'; // blue
                case 'hub': return '#4f46e5'; // indigo
                case 'provider': return '#ea580c'; // orange
                default: return '#78716c'; // stone
              }
            }}
            nodeStrokeColor="#1c1917" // stone-900
            nodeStrokeWidth={2}
            className="border-2 border-stone-900 rounded-xl overflow-hidden shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] bg-white"
          />
          <Background gap={16} size={2} color="#d6d3d1" />
        </ReactFlow>
      </div>
    </div>
    </div>
  );
}


