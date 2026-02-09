'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  CalendarDays,
  List,
  Plus,
  ChevronLeft,
  ChevronRight,
  X,
  MapPin,
  DollarSign,
  Clock,
  User,
  FileText,
} from 'lucide-react';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  parseISO,
  startOfWeek,
  endOfWeek,
  isPast,
} from 'date-fns';
import { useStore } from '@/store/useStore';
import { cn } from '@/lib/utils';
import type { Registration } from '@/types';

type ViewMode = 'list' | 'calendar';

export default function RegistrationsPage() {
  const router = useRouter();
  const { registrations, addRegistration, updateRegistration } = useStore();
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [showAddModal, setShowAddModal] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);

  // Group registrations by status
  const groupedRegistrations = useMemo(() => {
    const upcoming: Registration[] = [];
    const past: Registration[] = [];
    const cancelled: Registration[] = [];

    registrations.forEach((reg) => {
      if (reg.status === 'cancelled') {
        cancelled.push(reg);
      } else if (isPast(parseISO(reg.endDate))) {
        past.push(reg);
      } else {
        upcoming.push(reg);
      }
    });

    return { upcoming, past, cancelled };
  }, [registrations]);

  // Get registrations for selected day
  const getRegistrationsForDay = (day: Date) => {
    return registrations.filter((reg) => {
      const start = parseISO(reg.startDate);
      const end = parseISO(reg.endDate);
      return day >= start && day <= end;
    });
  };

  // Calendar days calculation
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart);
    const calendarEnd = endOfWeek(monthEnd);

    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentMonth]);

  const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f0f4f8' }}>
      {/* Header */}
      <header
        className="sticky top-0 z-40 border-b backdrop-blur-sm"
        style={{ backgroundColor: 'rgba(255,255,255,0.95)', borderColor: '#e2e8f0' }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.back()}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-slate-600" />
              </button>
              <h1 className="text-xl font-bold text-slate-900">My Registrations</h1>
              <span className="px-2.5 py-0.5 text-sm font-medium rounded-full"
                style={{
                  backgroundColor: 'color-mix(in srgb, var(--theme-primary) 12%, white)',
                  color: 'var(--theme-primary)',
                }}>
                {registrations.length}
              </span>
            </div>

            {/* View Toggle */}
            <div className="flex items-center gap-2 rounded-lg p-1" style={{ backgroundColor: '#f1f5f9' }}>
              <button
                onClick={() => setViewMode('list')}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-md transition-all text-sm font-medium',
                  viewMode === 'list'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                )}
              >
                <List className="w-4 h-4" />
                <span className="hidden sm:inline">List</span>
              </button>
              <button
                onClick={() => setViewMode('calendar')}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-md transition-all text-sm font-medium',
                  viewMode === 'calendar'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                )}
              >
                <CalendarDays className="w-4 h-4" />
                <span className="hidden sm:inline">Calendar</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <AnimatePresence mode="wait">
          {viewMode === 'list' ? (
            <ListView
              key="list"
              groupedRegistrations={groupedRegistrations}
              expandedCard={expandedCard}
              setExpandedCard={setExpandedCard}
              updateRegistration={updateRegistration}
            />
          ) : (
            <CalendarView
              key="calendar"
              currentMonth={currentMonth}
              calendarDays={calendarDays}
              selectedDay={selectedDay}
              setSelectedDay={setSelectedDay}
              handlePrevMonth={handlePrevMonth}
              handleNextMonth={handleNextMonth}
              getRegistrationsForDay={getRegistrationsForDay}
            />
          )}
        </AnimatePresence>
      </main>

      {/* Floating Add Button */}
      <button
        onClick={() => setShowAddModal(true)}
        className="fixed bottom-8 right-8 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-colors z-50 text-white"
        style={{ backgroundColor: 'var(--theme-primary)' }}
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Add Registration Modal */}
      <AddRegistrationModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={addRegistration}
      />
    </div>
  );
}

// List View Component
function ListView({
  groupedRegistrations,
  expandedCard,
  setExpandedCard,
  updateRegistration,
}: {
  groupedRegistrations: {
    upcoming: Registration[];
    past: Registration[];
    cancelled: Registration[];
  };
  expandedCard: string | null;
  setExpandedCard: (id: string | null) => void;
  updateRegistration: (id: string, updates: Partial<Registration>) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-8"
    >
      {/* Empty State */}
      {groupedRegistrations.upcoming.length === 0 &&
        groupedRegistrations.past.length === 0 &&
        groupedRegistrations.cancelled.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-6">
              <CalendarDays className="w-10 h-10 text-slate-400" />
            </div>
            <h3 className="text-xl font-semibold text-slate-900 mb-2">No Registrations Yet</h3>
            <p className="text-slate-500 mb-6 max-w-md">
              Start tracking your hockey clinic registrations by adding one manually or
              registering through the dashboard.
            </p>
          </div>
        )}

      {/* Upcoming */}
      {groupedRegistrations.upcoming.length > 0 && (
        <Section title="Upcoming" count={groupedRegistrations.upcoming.length}>
          {groupedRegistrations.upcoming.map((reg) => (
            <RegistrationCard
              key={reg.id}
              registration={reg}
              isExpanded={expandedCard === reg.id}
              onToggleExpand={() =>
                setExpandedCard(expandedCard === reg.id ? null : reg.id)
              }
              onUpdate={updateRegistration}
            />
          ))}
        </Section>
      )}

      {/* Past */}
      {groupedRegistrations.past.length > 0 && (
        <Section title="Past" count={groupedRegistrations.past.length}>
          {groupedRegistrations.past.map((reg) => (
            <RegistrationCard
              key={reg.id}
              registration={reg}
              isExpanded={expandedCard === reg.id}
              onToggleExpand={() =>
                setExpandedCard(expandedCard === reg.id ? null : reg.id)
              }
              onUpdate={updateRegistration}
            />
          ))}
        </Section>
      )}

      {/* Cancelled */}
      {groupedRegistrations.cancelled.length > 0 && (
        <Section title="Cancelled" count={groupedRegistrations.cancelled.length}>
          {groupedRegistrations.cancelled.map((reg) => (
            <RegistrationCard
              key={reg.id}
              registration={reg}
              isExpanded={expandedCard === reg.id}
              onToggleExpand={() =>
                setExpandedCard(expandedCard === reg.id ? null : reg.id)
              }
              onUpdate={updateRegistration}
            />
          ))}
        </Section>
      )}
    </motion.div>
  );
}

// Section Component
function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-lg font-semibold text-slate-700">{title}</h2>
        <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-sm rounded-full">
          {count}
        </span>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

// Registration Card Component
function RegistrationCard({
  registration,
  isExpanded,
  onToggleExpand,
  onUpdate,
}: {
  registration: Registration;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onUpdate: (id: string, updates: Partial<Registration>) => void;
}) {
  const getStatusColor = (status: Registration['status']) => {
    switch (status) {
      case 'confirmed':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'pending':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'waitlisted':
        return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'cancelled':
        return 'bg-red-50 text-red-700 border-red-200';
    }
  };

  return (
    <motion.div
      layout
      className="bg-white border border-slate-200 rounded-xl overflow-hidden hover:border-slate-300 transition-colors shadow-sm"
    >
      <button
        onClick={onToggleExpand}
        className="w-full p-4 text-left focus:outline-none focus:ring-2 focus:ring-inset"
        style={{ '--tw-ring-color': 'var(--theme-primary)' } as React.CSSProperties}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-3 mb-2">
              <h3 className="font-semibold text-slate-900 truncate">
                {registration.clinicName}
              </h3>
              <span
                className={cn(
                  'px-2 py-0.5 text-xs font-medium rounded border shrink-0',
                  getStatusColor(registration.status)
                )}
              >
                {registration.status}
              </span>
            </div>

            <div className="space-y-1.5 text-sm text-slate-500">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 shrink-0" />
                <span className="truncate">
                  {registration.venue}, {registration.city}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 shrink-0" />
                <span>
                  {format(parseISO(registration.startDate), 'MMM d')} -{' '}
                  {format(parseISO(registration.endDate), 'MMM d, yyyy')}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 shrink-0" />
                <span>
                  {registration.currency} {registration.price.toFixed(2)}
                </span>
              </div>
              {registration.playerName && (
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 shrink-0" />
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {registration.playerName.split(/[,&\/]/).map((name, i) => (
                      <span key={i} className="px-2 py-0.5 rounded-full text-xs font-medium"
                        style={{
                          backgroundColor: 'color-mix(in srgb, var(--theme-primary) 10%, white)',
                          color: 'var(--theme-primary)',
                          border: '1px solid color-mix(in srgb, var(--theme-primary) 20%, white)',
                        }}>
                        {name.trim()}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-slate-200"
          >
            <div className="p-4 space-y-3">
              {registration.notes && (
                <div className="bg-slate-50 rounded-lg p-3">
                  <div className="flex items-start gap-2 text-sm">
                    <FileText className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                    <div>
                      <div className="font-medium text-slate-700 mb-1">Notes</div>
                      <div className="text-slate-500">{registration.notes}</div>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                {registration.status !== 'cancelled' && (
                  <button
                    onClick={() =>
                      onUpdate(registration.id, { status: 'cancelled' })
                    }
                    className="flex-1 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors text-sm font-medium"
                  >
                    Mark as Cancelled
                  </button>
                )}
                <button
                  onClick={() => {
                    const notes = prompt('Add notes:', registration.notes);
                    if (notes !== null) {
                      onUpdate(registration.id, { notes });
                    }
                  }}
                  className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors text-sm font-medium"
                >
                  {registration.notes ? 'Edit Notes' : 'Add Notes'}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// Calendar View Component
function CalendarView({
  currentMonth,
  calendarDays,
  selectedDay,
  setSelectedDay,
  handlePrevMonth,
  handleNextMonth,
  getRegistrationsForDay,
}: {
  currentMonth: Date;
  calendarDays: Date[];
  selectedDay: Date | null;
  setSelectedDay: (day: Date | null) => void;
  handlePrevMonth: () => void;
  handleNextMonth: () => void;
  getRegistrationsForDay: (day: Date) => Registration[];
}) {
  const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      {/* Calendar Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-slate-900">
            {format(currentMonth, 'MMMM yyyy')}
          </h2>
          <div className="flex gap-2">
            <button
              onClick={handlePrevMonth}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-slate-600" />
            </button>
            <button
              onClick={handleNextMonth}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <ChevronRight className="w-5 h-5 text-slate-600" />
            </button>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-2">
          {/* Day Headers */}
          {dayNames.map((day) => (
            <div
              key={day}
              className="text-center text-sm font-medium text-slate-400 pb-2"
            >
              {day}
            </div>
          ))}

          {/* Calendar Days */}
          {calendarDays.map((day, index) => {
            const dayRegistrations = getRegistrationsForDay(day);
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isSelected = selectedDay && isSameDay(day, selectedDay);
            const hasRegistrations = dayRegistrations.length > 0;

            return (
              <button
                key={index}
                onClick={() =>
                  setSelectedDay(isSelected ? null : day)
                }
                className={cn(
                  'aspect-square p-2 rounded-lg text-sm transition-all relative',
                  isCurrentMonth
                    ? 'text-slate-900 hover:bg-slate-100'
                    : 'text-slate-400',
                  isSelected ? 'text-white' : '',
                  !isSelected && hasRegistrations ? 'font-semibold' : ''
                )}
                style={isSelected ? { backgroundColor: 'var(--theme-primary)', color: 'white' } : undefined}
              >
                {format(day, 'd')}
                {hasRegistrations && (
                  <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-1">
                    {dayRegistrations.slice(0, 3).map((reg, i) => (
                      <div
                        key={i}
                        className={cn(
                          'w-1.5 h-1.5 rounded-full',
                          reg.status === 'confirmed' && 'bg-emerald-500',
                          reg.status === 'pending' && 'bg-amber-500',
                          reg.status === 'waitlisted' && 'bg-orange-500',
                          reg.status === 'cancelled' && 'bg-red-500'
                        )}
                      />
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Day Registrations */}
      <AnimatePresence>
        {selectedDay && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-900">
                {format(selectedDay, 'EEEE, MMMM d, yyyy')}
              </h3>
              <button
                onClick={() => setSelectedDay(null)}
                className="p-1 hover:bg-slate-100 rounded transition-colors"
              >
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>

            {(() => {
              const dayRegs = getRegistrationsForDay(selectedDay);
              if (dayRegs.length === 0) {
                return (
                  <p className="text-slate-500 text-sm">
                    No registrations on this day
                  </p>
                );
              }

              return (
                <div className="space-y-2">
                  {dayRegs.map((reg) => (
                    <div
                      key={reg.id}
                      className="bg-slate-50 rounded-lg p-3 text-sm"
                    >
                      <div className="font-medium text-slate-900 mb-1">{reg.clinicName}</div>
                      <div className="text-slate-500">
                        {reg.venue}, {reg.city}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// Add Registration Modal Component
function AddRegistrationModal({
  isOpen,
  onClose,
  onAdd,
}: {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (registration: Registration) => void;
}) {
  const [formData, setFormData] = useState({
    clinicName: '',
    venue: '',
    city: '',
    startDate: '',
    endDate: '',
    price: '',
    status: 'confirmed' as Registration['status'],
    playerName: '',
    notes: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const registration: Registration = {
      id: `manual-${Date.now()}`,
      clinicId: '',
      clinicName: formData.clinicName,
      venue: formData.venue,
      city: formData.city,
      startDate: new Date(formData.startDate).toISOString(),
      endDate: new Date(formData.endDate).toISOString(),
      price: parseFloat(formData.price) || 0,
      currency: 'USD',
      registeredAt: new Date().toISOString(),
      status: formData.status,
      source: 'manual',
      notes: formData.notes,
      playerName: formData.playerName || undefined,
    };

    onAdd(registration);
    onClose();

    // Reset form
    setFormData({
      clinicName: '',
      venue: '',
      city: '',
      startDate: '',
      endDate: '',
      price: '',
      status: 'confirmed',
      playerName: '',
      notes: '',
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white border border-slate-200 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-xl"
      >
        <div className="sticky top-0 bg-white border-b border-slate-200 p-4 flex items-center justify-between rounded-t-xl">
          <h2 className="text-xl font-semibold text-slate-900">Add Registration</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Clinic Name *
            </label>
            <input
              type="text"
              required
              value={formData.clinicName}
              onChange={(e) =>
                setFormData({ ...formData, clinicName: e.target.value })
              }
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:border-transparent outline-none text-slate-900 placeholder:text-slate-400"
              style={{ '--tw-ring-color': 'var(--theme-primary)' } as React.CSSProperties}
              placeholder="Summer Hockey Camp"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Venue *
              </label>
              <input
                type="text"
                required
                value={formData.venue}
                onChange={(e) =>
                  setFormData({ ...formData, venue: e.target.value })
                }
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:border-transparent outline-none text-slate-900 placeholder:text-slate-400"
                style={{ '--tw-ring-color': 'var(--theme-primary)' } as React.CSSProperties}
                placeholder="Ice Arena"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                City *
              </label>
              <input
                type="text"
                required
                value={formData.city}
                onChange={(e) =>
                  setFormData({ ...formData, city: e.target.value })
                }
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:border-transparent outline-none text-slate-900 placeholder:text-slate-400"
                style={{ '--tw-ring-color': 'var(--theme-primary)' } as React.CSSProperties}
                placeholder="Boston"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Start Date *
              </label>
              <input
                type="date"
                required
                value={formData.startDate}
                onChange={(e) =>
                  setFormData({ ...formData, startDate: e.target.value })
                }
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:border-transparent outline-none text-slate-900 [color-scheme:light]"
                style={{ '--tw-ring-color': 'var(--theme-primary)' } as React.CSSProperties}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                End Date *
              </label>
              <input
                type="date"
                required
                value={formData.endDate}
                onChange={(e) =>
                  setFormData({ ...formData, endDate: e.target.value })
                }
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:border-transparent outline-none text-slate-900 [color-scheme:light]"
                style={{ '--tw-ring-color': 'var(--theme-primary)' } as React.CSSProperties}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Price (USD) *
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={formData.price}
                onChange={(e) =>
                  setFormData({ ...formData, price: e.target.value })
                }
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:border-transparent outline-none text-slate-900 placeholder:text-slate-400"
                style={{ '--tw-ring-color': 'var(--theme-primary)' } as React.CSSProperties}
                placeholder="299.00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Status *
              </label>
              <select
                value={formData.status}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    status: e.target.value as Registration['status'],
                  })
                }
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:border-transparent outline-none text-slate-900 [color-scheme:light]"
                style={{ '--tw-ring-color': 'var(--theme-primary)' } as React.CSSProperties}
              >
                <option value="confirmed">Confirmed</option>
                <option value="pending">Pending</option>
                <option value="waitlisted">Waitlisted</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Player Name
            </label>
            <input
              type="text"
              value={formData.playerName}
              onChange={(e) =>
                setFormData({ ...formData, playerName: e.target.value })
              }
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:border-transparent outline-none text-slate-900 placeholder:text-slate-400"
              style={{ '--tw-ring-color': 'var(--theme-primary)' } as React.CSSProperties}
              placeholder="Optional"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              rows={3}
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:border-transparent outline-none resize-none text-slate-900 placeholder:text-slate-400"
              style={{ '--tw-ring-color': 'var(--theme-primary)' } as React.CSSProperties}
              placeholder="Additional information..."
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 text-white rounded-lg transition-colors font-medium hover:opacity-90"
              style={{ backgroundColor: 'var(--theme-primary)' }}
            >
              Add Registration
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
