import { useState, useEffect, useMemo } from 'react';
import { 
  BrowserRouter as Router, 
  Routes, 
  Route, 
  Link, 
  useNavigate, 
  useLocation 
} from 'react-router-dom';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  User 
} from 'firebase/auth';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  where,
  getDocFromServer
} from 'firebase/firestore';
import { 
  LayoutDashboard, 
  Users, 
  PlusCircle, 
  LogOut, 
  Building2, 
  Search, 
  Filter,
  MoreVertical,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import { format } from 'date-fns';
import { auth, db } from './firebase';
import { Employee, Department, OperationType, FirestoreErrorInfo } from './types';

// --- Error Handling ---
function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// --- Components ---

const LoadingScreen = () => (
  <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50">
    <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
    <p className="text-slate-600 font-medium">Initializing StaffSync EMS...</p>
  </div>
);

const Sidebar = ({ user }: { user: User }) => {
  const location = useLocation();
  const navItems = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/employees', label: 'Employees', icon: Users },
    { path: '/add', label: 'Add Employee', icon: PlusCircle },
    { path: '/departments', label: 'Departments', icon: Building2 },
  ];

  return (
    <div className="w-64 bg-white border-r border-slate-200 flex flex-col h-screen sticky top-0">
      <div className="p-6">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <Users className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">StaffSync</h1>
        </div>
        
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                  isActive 
                    ? 'bg-indigo-50 text-indigo-700 font-semibold' 
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-indigo-600' : ''}`} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="mt-auto p-6 border-t border-slate-100">
        <div className="flex items-center gap-3 mb-4 px-2">
          <img 
            src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`} 
            alt="Profile" 
            className="w-10 h-10 rounded-full border-2 border-slate-100"
            referrerPolicy="no-referrer"
          />
          <div className="overflow-hidden">
            <p className="text-sm font-semibold text-slate-900 truncate">{user.displayName}</p>
            <p className="text-xs text-slate-500 truncate">{user.email}</p>
          </div>
        </div>
        <button 
          onClick={() => signOut(auth)}
          className="flex items-center gap-3 w-full px-4 py-3 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all duration-200"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium">Sign Out</span>
        </button>
      </div>
    </div>
  );
};

const Dashboard = ({ employees }: { employees: Employee[] }) => {
  const stats = useMemo(() => {
    const active = employees.filter(e => e.status === 'active').length;
    const inactive = employees.length - active;
    
    const deptCount: Record<string, number> = {};
    employees.forEach(e => {
      deptCount[e.department] = (deptCount[e.department] || 0) + 1;
    });

    const chartData = Object.entries(deptCount).map(([name, value]) => ({ name, value }));
    const statusData = [
      { name: 'Active', value: active, color: '#10b981' },
      { name: 'Inactive', value: inactive, color: '#ef4444' }
    ];

    return { active, inactive, total: employees.length, chartData, statusData };
  }, [employees]);

  return (
    <div className="space-y-8">
      <header>
        <h2 className="text-3xl font-bold text-slate-900">Dashboard</h2>
        <p className="text-slate-500 mt-1">Overview of your workforce analytics.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'Total Employees', value: stats.total, icon: Users, color: 'bg-blue-500' },
          { label: 'Active Staff', value: stats.active, icon: CheckCircle2, color: 'bg-emerald-500' },
          { label: 'Inactive Staff', value: stats.inactive, icon: XCircle, color: 'bg-rose-500' },
        ].map((stat, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">{stat.label}</p>
                <p className="text-4xl font-bold text-slate-900 mt-2">{stat.value}</p>
              </div>
              <div className={`${stat.color} p-3 rounded-xl shadow-lg shadow-opacity-20`}>
                <stat.icon className="w-6 h-6 text-white" />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 mb-6">Department Distribution</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                  cursor={{ fill: '#f8fafc' }}
                />
                <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 mb-6">Staff Status</h3>
          <div className="h-80 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.statusData}
                  innerRadius={80}
                  outerRadius={120}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {stats.statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute flex flex-col items-center">
              <span className="text-3xl font-bold text-slate-900">{stats.total}</span>
              <span className="text-xs text-slate-500 uppercase tracking-widest">Total</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const EmployeeList = ({ employees, onDelete }: { employees: Employee[], onDelete: (id: string) => void }) => {
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('All');

  const filtered = employees.filter(e => {
    const matchesSearch = `${e.firstName} ${e.lastName} ${e.email}`.toLowerCase().includes(search.toLowerCase());
    const matchesDept = deptFilter === 'All' || e.department === deptFilter;
    return matchesSearch && matchesDept;
  });

  const departments = ['All', ...Array.from(new Set(employees.map(e => e.department)))];

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Employees</h2>
          <p className="text-slate-500 mt-1">Manage your team members and their records.</p>
        </div>
        <Link 
          to="/add" 
          className="inline-flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
        >
          <PlusCircle className="w-5 h-5" />
          Add Employee
        </Link>
      </header>

      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search by name or email..." 
            className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="relative min-w-[200px]">
          <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <select 
            className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 appearance-none transition-all"
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
          >
            {departments.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Employee</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Department</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Position</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            <AnimatePresence>
              {filtered.map((e) => (
                <motion.tr 
                  key={e.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="hover:bg-slate-50 transition-colors group"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold">
                        {e.firstName[0]}{e.lastName[0]}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">{e.firstName} {e.lastName}</p>
                        <p className="text-xs text-slate-500">{e.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-semibold">
                      {e.department}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">{e.position}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                      e.status === 'active' 
                        ? 'bg-emerald-100 text-emerald-700' 
                        : 'bg-rose-100 text-rose-700'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${e.status === 'active' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                      {e.status.charAt(0).toUpperCase() + e.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Link to={`/edit/${e.id}`} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all">
                        <Edit2 className="w-4 h-4" />
                      </Link>
                      <button 
                        onClick={() => e.id && onDelete(e.id)}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-slate-300" />
            </div>
            <p className="text-slate-500 font-medium">No employees found matching your criteria.</p>
          </div>
        )}
      </div>
    </div>
  );
};

const EmployeeForm = ({ initialData, onSubmit }: { initialData?: Employee, onSubmit: (data: Partial<Employee>) => void }) => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<Partial<Employee>>(initialData || {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    department: '',
    position: '',
    salary: 0,
    hireDate: format(new Date(), 'yyyy-MM-dd'),
    status: 'active'
  });

  const handleSubmit = (e: any) => {
    e.preventDefault();
    onSubmit(formData);
    navigate('/employees');
  };

  return (
    <div className="max-w-3xl mx-auto">
      <header className="mb-8">
        <h2 className="text-3xl font-bold text-slate-900">{initialData ? 'Edit Employee' : 'Add New Employee'}</h2>
        <p className="text-slate-500 mt-1">Fill in the details below to {initialData ? 'update' : 'register'} a staff member.</p>
      </header>

      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">First Name</label>
            <input 
              required
              type="text" 
              className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all"
              value={formData.firstName}
              onChange={e => setFormData({...formData, firstName: e.target.value})}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Last Name</label>
            <input 
              required
              type="text" 
              className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all"
              value={formData.lastName}
              onChange={e => setFormData({...formData, lastName: e.target.value})}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Work Email</label>
            <input 
              required
              type="email" 
              className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all"
              value={formData.email}
              onChange={e => setFormData({...formData, email: e.target.value})}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Phone Number</label>
            <input 
              type="tel" 
              className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all"
              value={formData.phone}
              onChange={e => setFormData({...formData, phone: e.target.value})}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Department</label>
            <select 
              required
              className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all"
              value={formData.department}
              onChange={e => setFormData({...formData, department: e.target.value})}
            >
              <option value="">Select Department</option>
              <option value="Engineering">Engineering</option>
              <option value="Marketing">Marketing</option>
              <option value="Sales">Sales</option>
              <option value="HR">HR</option>
              <option value="Finance">Finance</option>
              <option value="Operations">Operations</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Position</label>
            <input 
              required
              type="text" 
              className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all"
              value={formData.position}
              onChange={e => setFormData({...formData, position: e.target.value})}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Annual Salary ($)</label>
            <input 
              type="number" 
              className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all"
              value={formData.salary}
              onChange={e => setFormData({...formData, salary: Number(e.target.value)})}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Hire Date</label>
            <input 
              type="date" 
              className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all"
              value={formData.hireDate}
              onChange={e => setFormData({...formData, hireDate: e.target.value})}
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700">Status</label>
          <div className="flex gap-4">
            {['active', 'inactive'].map(s => (
              <label key={s} className={`flex-1 flex items-center justify-center gap-2 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                formData.status === s 
                  ? 'border-indigo-600 bg-indigo-50 text-indigo-700' 
                  : 'border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200'
              }`}>
                <input 
                  type="radio" 
                  className="hidden" 
                  name="status" 
                  value={s} 
                  checked={formData.status === s}
                  onChange={() => setFormData({...formData, status: s as 'active' | 'inactive'})}
                />
                {s === 'active' ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                <span className="font-bold capitalize">{s}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="pt-6 flex gap-4">
          <button 
            type="button"
            onClick={() => navigate('/employees')}
            className="flex-1 py-4 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-all"
          >
            Cancel
          </button>
          <button 
            type="submit"
            className="flex-1 py-4 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
          >
            {initialData ? 'Update Employee' : 'Save Employee'}
          </button>
        </div>
      </form>
    </div>
  );
};

const Login = () => {
  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-white p-12 rounded-3xl border border-slate-200 shadow-2xl text-center"
      >
        <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-xl shadow-indigo-200">
          <Users className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-4">StaffSync</h1>
        <p className="text-slate-500 text-lg mb-10">The modern operating system for your workforce management.</p>
        
        <button 
          onClick={handleLogin}
          className="w-full flex items-center justify-center gap-4 bg-white border-2 border-slate-200 py-4 rounded-2xl font-bold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all group"
        >
          <img src="https://www.google.com/favicon.ico" className="w-6 h-6" alt="Google" />
          Sign in with Google
        </button>
        
        <p className="mt-8 text-xs text-slate-400 uppercase tracking-widest font-bold">Admin Portal Access Only</p>
      </motion.div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsAuthReady(true);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!isAuthReady || !user) {
      setEmployees([]);
      return;
    }

    // Test connection
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    };
    testConnection();

    const q = query(collection(db, 'employees'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee));
      setEmployees(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'employees');
    });

    return unsubscribe;
  }, [isAuthReady, user]);

  const handleAddEmployee = async (data: Partial<Employee>) => {
    if (!user) return;
    try {
      await addDoc(collection(db, 'employees'), { ...data, uid: user.uid });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'employees');
    }
  };

  const handleUpdateEmployee = async (id: string, data: Partial<Employee>) => {
    try {
      await updateDoc(doc(db, 'employees', id), data);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `employees/${id}`);
    }
  };

  const handleDeleteEmployee = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this employee?')) return;
    try {
      await deleteDoc(doc(db, 'employees', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `employees/${id}`);
    }
  };

  if (loading) return <LoadingScreen />;
  if (!user) return <Login />;

  return (
    <Router>
      <div className="flex min-h-screen bg-slate-50 font-sans antialiased">
        <Sidebar user={user} />
        
        <main className="flex-1 p-10 max-w-7xl mx-auto w-full">
          <Routes>
            <Route path="/" element={<Dashboard employees={employees} />} />
            <Route path="/employees" element={<EmployeeList employees={employees} onDelete={handleDeleteEmployee} />} />
            <Route path="/add" element={<EmployeeForm onSubmit={handleAddEmployee} />} />
            <Route path="/edit/:id" element={<EditWrapper employees={employees} onUpdate={handleUpdateEmployee} />} />
            <Route path="/departments" element={<DepartmentsView employees={employees} />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

const EditWrapper = ({ employees, onUpdate }: { employees: Employee[], onUpdate: (id: string, data: Partial<Employee>) => void }) => {
  const params = useLocation();
  const employeeId = params.pathname.split('/').pop();
  const employee = employees.find(e => e.id === employeeId);

  if (!employee) return <div className="p-8 text-center text-slate-500">Employee not found.</div>;

  return <EmployeeForm initialData={employee} onSubmit={(data) => employeeId && onUpdate(employeeId, data)} />;
};

const DepartmentsView = ({ employees }: { employees: Employee[] }) => {
  const depts = useMemo(() => {
    const map: Record<string, number> = {};
    employees.forEach(e => {
      map[e.department] = (map[e.department] || 0) + 1;
    });
    return Object.entries(map).map(([name, count]) => ({ name, count }));
  }, [employees]);

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-3xl font-bold text-slate-900">Departments</h2>
        <p className="text-slate-500 mt-1">Organizational structure and headcounts.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {depts.map((dept, i) => (
          <motion.div 
            key={dept.name}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.05 }}
            className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600">
                <Building2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">{dept.name}</h3>
                <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">{dept.count} Members</p>
              </div>
            </div>
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div 
                className="bg-indigo-600 h-full rounded-full" 
                style={{ width: `${(dept.count / employees.length) * 100}%` }}
              />
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
