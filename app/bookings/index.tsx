import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Platform, TextInput, Modal, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { DesktopShell } from '@/components/desktop/DesktopShell';
import { Colors, Typography, BorderRadius, Spacing } from '@/constants/tokens';
import { useRouter } from 'expo-router';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || '';
const DEMO_USER_ID = '00000000-0000-0000-0000-000000000001';

interface User {
  id: string;
  name: string;
  businessName: string;
  bookingSlug: string;
  logoUrl?: string | null;
  accentColor?: string | null;
}

const ACCENT_COLORS = [
  { name: 'Blue', color: '#3b82f6' },
  { name: 'Purple', color: '#8b5cf6' },
  { name: 'Pink', color: '#ec4899' },
  { name: 'Red', color: '#ef4444' },
  { name: 'Orange', color: '#f97316' },
  { name: 'Yellow', color: '#eab308' },
  { name: 'Green', color: '#22c55e' },
  { name: 'Teal', color: '#3B82F6' },
  { name: 'Cyan', color: '#3B82F6' },
];

interface Booking {
  id: string;
  clientName: string;
  clientEmail: string;
  scheduledAt: string;
  duration: number;
  status: string;
  paymentStatus: string;
  amount: number;
  currency: string;
}

interface Service {
  id: string;
  name: string;
  description?: string;
  duration: number;
  price: number;
  isActive: boolean;
  color: string;
}

interface AvailabilitySlot {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
}

interface BufferSettings {
  beforeBuffer: number;
  afterBuffer: number;
  minimumNotice: number;
  maxAdvanceBooking: number;
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DEFAULT_AVAILABILITY: AvailabilitySlot[] = DAYS.map((_, i) => ({
  dayOfWeek: i,
  startTime: '09:00',
  endTime: '17:00',
  isActive: i >= 1 && i <= 5,
}));

export default function BookingsPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<'upcoming' | 'all' | 'services' | 'settings'>('upcoming');
  const [user, setUser] = useState<User | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [availability, setAvailability] = useState<AvailabilitySlot[]>(DEFAULT_AVAILABILITY);
  const [bufferSettings, setBufferSettings] = useState<BufferSettings>({
    beforeBuffer: 0, afterBuffer: 15, minimumNotice: 60, maxAdvanceBooking: 30
  });
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, upcoming: 0, revenue: 0 });
  const [bookingLink, setBookingLink] = useState('');
  const [copied, setCopied] = useState(false);

  const [showServiceModal, setShowServiceModal] = useState(false);
  const [showAvailabilityModal, setShowAvailabilityModal] = useState(false);
  const [showBufferModal, setShowBufferModal] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [serviceForm, setServiceForm] = useState({ name: '', description: '', duration: '60', price: '0', color: '#3B82F6' });
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const userRes = await fetch(`${API_BASE}/api/users/${DEMO_USER_ID}`);
      if (userRes.ok) {
        const userData = await userRes.json();
        setUser(userData);
        const domain = Platform.OS === 'web' ? window.location.origin : process.env.EXPO_PUBLIC_DOMAIN || 'https://aspire.app';
        setBookingLink(`${domain}/book/${userData.bookingSlug || 'zenith-solutions'}`);
      }

      const [bookingsRes, servicesRes, statsRes, availRes, bufferRes] = await Promise.all([
        fetch(`${API_BASE}/api/users/${DEMO_USER_ID}/bookings`),
        fetch(`${API_BASE}/api/users/${DEMO_USER_ID}/services`),
        fetch(`${API_BASE}/api/users/${DEMO_USER_ID}/bookings/stats`),
        fetch(`${API_BASE}/api/users/${DEMO_USER_ID}/availability`),
        fetch(`${API_BASE}/api/users/${DEMO_USER_ID}/buffer-settings`),
      ]);

      if (bookingsRes.ok) setBookings(await bookingsRes.json());
      if (servicesRes.ok) setServices(await servicesRes.json());
      if (statsRes.ok) setStats(await statsRes.json());
      if (availRes.ok) {
        const avail = await availRes.json();
        if (avail.length > 0) {
          const merged = DEFAULT_AVAILABILITY.map(d => {
            const match = avail.find((a: AvailabilitySlot) => a.dayOfWeek === d.dayOfWeek);
            return match || d;
          });
          setAvailability(merged);
        }
      }
      if (bufferRes.ok) setBufferSettings(await bufferRes.json());
    } catch (error) {
      console.error('Error loading data:', error);
    }
    setLoading(false);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  const formatCurrency = (amount: number, currency: string = 'usd') => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(amount / 100);
  };

  const getLogoUrl = (logoUrl: string | null | undefined): string | null => {
    if (!logoUrl) return null;
    // If it's already an absolute URL, use it as-is
    if (logoUrl.startsWith('http')) return logoUrl;
    // If it's a relative path, construct full URL
    if (Platform.OS === 'web') {
      return `${window.location.origin}${logoUrl}`;
    }
    return logoUrl;
  };

  const copyBookingLink = async () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(bookingLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const openBookingPage = () => {
    if (user?.bookingSlug) {
      router.push(`/book/${user.bookingSlug}` as any);
    } else {
      router.push('/book/zenith-solutions' as any);
    }
  };

  const handleAccentColorChange = async (color: string) => {
    try {
      await fetch(`${API_BASE}/api/users/${DEMO_USER_ID}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accentColor: color }),
      });
      setUser(prev => prev ? { ...prev, accentColor: color } : null);
    } catch (error) {
      console.error('Error updating accent color:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return Colors.semantic.success;
      case 'pending': return Colors.semantic.warning;
      case 'cancelled': return Colors.semantic.error;
      default: return Colors.text.muted;
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingLogo(true);
    try {
      const urlRes = await fetch(`${API_BASE}/api/uploads/request-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
      });
      const { uploadURL, objectPath } = await urlRes.json();

      await fetch(uploadURL, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      });

      // Save relative path - construct full URL at display time
      await fetch(`${API_BASE}/api/users/${DEMO_USER_ID}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logoUrl: objectPath }),
      });

      setUser(prev => prev ? { ...prev, logoUrl: objectPath } : null);
    } catch (error) {
      console.error('Error uploading logo:', error);
    }
    setUploadingLogo(false);
  };

  const openAddService = () => {
    setEditingService(null);
    setServiceForm({ name: '', description: '', duration: '60', price: '0', color: '#3B82F6' });
    setShowServiceModal(true);
  };

  const openEditService = (service: Service) => {
    setEditingService(service);
    setServiceForm({
      name: service.name,
      description: service.description || '',
      duration: String(service.duration),
      price: String(service.price / 100),
      color: service.color,
    });
    setShowServiceModal(true);
  };

  const saveService = async () => {
    setSaving(true);
    try {
      const payload = {
        name: serviceForm.name,
        description: serviceForm.description,
        duration: parseInt(serviceForm.duration) || 60,
        price: Math.round(parseFloat(serviceForm.price) * 100) || 0,
        color: serviceForm.color,
        isActive: true,
      };

      if (editingService) {
        await fetch(`${API_BASE}/api/services/${editingService.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        await fetch(`${API_BASE}/api/users/${DEMO_USER_ID}/services`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }
      await loadData();
      setShowServiceModal(false);
    } catch (error) {
      console.error('Error saving service:', error);
    }
    setSaving(false);
  };

  const deleteService = async (serviceId: string) => {
    try {
      await fetch(`${API_BASE}/api/services/${serviceId}`, { method: 'DELETE' });
      await loadData();
    } catch (error) {
      console.error('Error deleting service:', error);
    }
  };

  const saveAvailability = async () => {
    setSaving(true);
    try {
      await fetch(`${API_BASE}/api/users/${DEMO_USER_ID}/availability`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slots: availability }),
      });
      setShowAvailabilityModal(false);
    } catch (error) {
      console.error('Error saving availability:', error);
    }
    setSaving(false);
  };

  const saveBufferSettings = async () => {
    setSaving(true);
    try {
      await fetch(`${API_BASE}/api/users/${DEMO_USER_ID}/buffer-settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bufferSettings),
      });
      setShowBufferModal(false);
    } catch (error) {
      console.error('Error saving buffer settings:', error);
    }
    setSaving(false);
  };

  const updateAvailability = (dayOfWeek: number, field: keyof AvailabilitySlot, value: any) => {
    setAvailability(prev => prev.map(slot => 
      slot.dayOfWeek === dayOfWeek ? { ...slot, [field]: value } : slot
    ));
  };

  const upcomingBookings = bookings.filter(b => 
    new Date(b.scheduledAt) > new Date() && b.status === 'confirmed'
  );

  return (
    <DesktopShell>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.logoSection}>
              {Platform.OS === 'web' && (
                <input
                  type="file"
                  ref={fileInputRef as any}
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handleLogoUpload as any}
                />
              )}
              <Pressable 
                style={styles.logoUploadContainer} 
                onPress={() => (fileInputRef.current as any)?.click()}
              >
                {uploadingLogo ? (
                  <ActivityIndicator size="small" color={Colors.accent.cyan} />
                ) : getLogoUrl(user?.logoUrl) ? (
                  <Image source={{ uri: getLogoUrl(user?.logoUrl)! }} style={styles.logoPreview} />
                ) : (
                  <View style={styles.logoPlaceholder}>
                    <Ionicons name="image-outline" size={24} color={Colors.text.muted} />
                    <Text style={styles.logoPlaceholderText}>Upload Logo</Text>
                  </View>
                )}
                <View style={styles.logoEditBadge}>
                  <Ionicons name="camera" size={12} color="#fff" />
                </View>
              </Pressable>
            </View>
            <View>
              <Text style={styles.title}>Bookings</Text>
              <Text style={styles.subtitle}>Manage your appointments and client bookings</Text>
            </View>
          </View>
          <View style={styles.shareButtonsRow}>
            <Pressable style={styles.shareButton} onPress={copyBookingLink}>
              <Ionicons name={copied ? "checkmark" : "copy-outline"} size={18} color="#fff" />
              <Text style={styles.shareButtonText}>{copied ? 'Copied!' : 'Copy Link'}</Text>
            </Pressable>
            <Pressable style={styles.viewButton} onPress={openBookingPage}>
              <Ionicons name="open-outline" size={18} color="#fff" />
              <Text style={styles.shareButtonText}>View Page</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <LinearGradient 
              colors={['rgba(59, 130, 246, 0.25)', 'rgba(37, 99, 235, 0.12)', 'rgba(29, 78, 216, 0.05)']} 
              start={{ x: 0, y: 0 }} 
              end={{ x: 1, y: 1 }}
              style={[styles.statGradient, { borderColor: 'rgba(59, 130, 246, 0.3)' }]}
            >
              <View style={[styles.statIconContainer, { backgroundColor: 'rgba(59, 130, 246, 0.2)' }]}>
                <Ionicons name="calendar" size={22} color="#3B82F6" />
              </View>
              <Text style={styles.statValue}>{stats.upcoming}</Text>
              <Text style={styles.statLabel}>Upcoming</Text>
            </LinearGradient>
          </View>
          <View style={styles.statCard}>
            <LinearGradient 
              colors={['rgba(34, 197, 94, 0.25)', 'rgba(22, 163, 74, 0.12)', 'rgba(21, 128, 61, 0.05)']} 
              start={{ x: 0, y: 0 }} 
              end={{ x: 1, y: 1 }}
              style={[styles.statGradient, { borderColor: 'rgba(34, 197, 94, 0.3)' }]}
            >
              <View style={[styles.statIconContainer, { backgroundColor: 'rgba(34, 197, 94, 0.2)' }]}>
                <Ionicons name="checkmark-circle" size={22} color="#22C55E" />
              </View>
              <Text style={styles.statValue}>{stats.total}</Text>
              <Text style={styles.statLabel}>Total Bookings</Text>
            </LinearGradient>
          </View>
          <View style={styles.statCard}>
            <LinearGradient 
              colors={['rgba(245, 158, 11, 0.25)', 'rgba(217, 119, 6, 0.12)', 'rgba(180, 83, 9, 0.05)']} 
              start={{ x: 0, y: 0 }} 
              end={{ x: 1, y: 1 }}
              style={[styles.statGradient, { borderColor: 'rgba(245, 158, 11, 0.3)' }]}
            >
              <View style={[styles.statIconContainer, { backgroundColor: 'rgba(245, 158, 11, 0.2)' }]}>
                <Ionicons name="cash" size={22} color="#F59E0B" />
              </View>
              <Text style={styles.statValue}>{formatCurrency(stats.revenue)}</Text>
              <Text style={styles.statLabel}>Revenue</Text>
            </LinearGradient>
          </View>
        </View>

        <View style={styles.tabRow}>
          {(['upcoming', 'all', 'services', 'settings'] as const).map((tab) => (
            <Pressable key={tab} style={[styles.tab, activeTab === tab && styles.tabActive]} onPress={() => setActiveTab(tab)}>
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.accent.cyan} />
          </View>
        ) : (
          <>
            {activeTab === 'upcoming' && (
              <View style={styles.section}>
                {upcomingBookings.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Ionicons name="calendar-outline" size={48} color={Colors.text.muted} />
                    <Text style={styles.emptyTitle}>No upcoming bookings</Text>
                    <Text style={styles.emptySubtitle}>Share your booking link to get started</Text>
                  </View>
                ) : (
                  upcomingBookings.map((booking) => (
                    <View key={booking.id} style={styles.bookingCard}>
                      <View style={styles.bookingHeader}>
                        <View style={styles.bookingDate}>
                          <Text style={styles.bookingDay}>{formatDate(booking.scheduledAt)}</Text>
                          <Text style={styles.bookingTime}>{formatTime(booking.scheduledAt)}</Text>
                        </View>
                        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(booking.status) + '20' }]}>
                          <View style={[styles.statusDot, { backgroundColor: getStatusColor(booking.status) }]} />
                          <Text style={[styles.statusText, { color: getStatusColor(booking.status) }]}>{booking.status}</Text>
                        </View>
                      </View>
                      <View style={styles.bookingDetails}>
                        <Text style={styles.clientName}>{booking.clientName}</Text>
                        <Text style={styles.clientEmail}>{booking.clientEmail}</Text>
                      </View>
                      <View style={styles.bookingFooter}>
                        <Text style={styles.duration}>{booking.duration} min</Text>
                        <Text style={styles.amount}>{formatCurrency(booking.amount, booking.currency)}</Text>
                      </View>
                    </View>
                  ))
                )}
              </View>
            )}

            {activeTab === 'all' && (
              <View style={styles.section}>
                {bookings.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Ionicons name="calendar-outline" size={48} color={Colors.text.muted} />
                    <Text style={styles.emptyTitle}>No bookings yet</Text>
                    <Text style={styles.emptySubtitle}>Your booking history will appear here</Text>
                  </View>
                ) : (
                  bookings.map((booking) => (
                    <View key={booking.id} style={styles.bookingCard}>
                      <View style={styles.bookingHeader}>
                        <View style={styles.bookingDate}>
                          <Text style={styles.bookingDay}>{formatDate(booking.scheduledAt)}</Text>
                          <Text style={styles.bookingTime}>{formatTime(booking.scheduledAt)}</Text>
                        </View>
                        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(booking.status) + '20' }]}>
                          <View style={[styles.statusDot, { backgroundColor: getStatusColor(booking.status) }]} />
                          <Text style={[styles.statusText, { color: getStatusColor(booking.status) }]}>{booking.status}</Text>
                        </View>
                      </View>
                      <View style={styles.bookingDetails}>
                        <Text style={styles.clientName}>{booking.clientName}</Text>
                        <Text style={styles.clientEmail}>{booking.clientEmail}</Text>
                      </View>
                      <View style={styles.bookingFooter}>
                        <Text style={styles.duration}>{booking.duration} min</Text>
                        <Text style={styles.amount}>{formatCurrency(booking.amount, booking.currency)}</Text>
                      </View>
                    </View>
                  ))
                )}
              </View>
            )}

            {activeTab === 'services' && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Your Services</Text>
                  <Pressable style={styles.addButton} onPress={openAddService}>
                    <Ionicons name="add" size={20} color="#fff" />
                    <Text style={styles.addButtonText}>Add Service</Text>
                  </Pressable>
                </View>
                {services.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Ionicons name="pricetag-outline" size={48} color={Colors.text.muted} />
                    <Text style={styles.emptyTitle}>No services yet</Text>
                    <Text style={styles.emptySubtitle}>Add services that clients can book</Text>
                  </View>
                ) : (
                  services.map((service) => (
                    <Pressable key={service.id} style={styles.serviceCard} onPress={() => openEditService(service)}>
                      <View style={[styles.serviceColor, { backgroundColor: service.color }]} />
                      <View style={styles.serviceInfo}>
                        <Text style={styles.serviceName}>{service.name}</Text>
                        <Text style={styles.serviceMeta}>{service.duration} min · {formatCurrency(service.price)}</Text>
                      </View>
                      <Pressable style={styles.deleteButton} onPress={() => deleteService(service.id)}>
                        <Ionicons name="trash-outline" size={18} color={Colors.semantic.error} />
                      </Pressable>
                      <View style={[styles.activeIndicator, { backgroundColor: service.isActive ? Colors.semantic.success : Colors.text.muted }]} />
                    </Pressable>
                  ))
                )}
              </View>
            )}

            {activeTab === 'settings' && (
              <View style={styles.section}>
                <View style={styles.settingsCard}>
                  <Text style={styles.settingsTitle}>Availability</Text>
                  <Text style={styles.settingsSubtitle}>Set your available hours for bookings</Text>
                  <Pressable style={styles.settingsButton} onPress={() => setShowAvailabilityModal(true)}>
                    <Text style={styles.settingsButtonText}>Configure Availability</Text>
                    <Ionicons name="chevron-forward" size={18} color={Colors.accent.cyan} />
                  </Pressable>
                </View>
                <View style={styles.settingsCard}>
                  <Text style={styles.settingsTitle}>Buffer Time</Text>
                  <Text style={styles.settingsSubtitle}>Add time between appointments</Text>
                  <Pressable style={styles.settingsButton} onPress={() => setShowBufferModal(true)}>
                    <Text style={styles.settingsButtonText}>Configure Buffer</Text>
                    <Ionicons name="chevron-forward" size={18} color={Colors.accent.cyan} />
                  </Pressable>
                </View>
                <View style={styles.settingsCard}>
                  <Text style={styles.settingsTitle}>Booking Link</Text>
                  <Text style={styles.settingsSubtitle}>{bookingLink || 'Not configured'}</Text>
                  <Pressable style={styles.settingsButton} onPress={copyBookingLink}>
                    <Text style={styles.settingsButtonText}>{copied ? 'Copied!' : 'Copy Link'}</Text>
                    <Ionicons name="copy-outline" size={18} color={Colors.accent.cyan} />
                  </Pressable>
                </View>
                <View style={styles.settingsCard}>
                  <Text style={styles.settingsTitle}>Accent Color</Text>
                  <Text style={styles.settingsSubtitle}>Customize the accent color for your booking page</Text>
                  <View style={styles.colorPickerContainer}>
                    {ACCENT_COLORS.map((accent) => (
                      <Pressable 
                        key={accent.color} 
                        style={[
                          styles.colorOption,
                          { backgroundColor: accent.color },
                          (user?.accentColor || '#3b82f6') === accent.color && styles.colorOptionSelected,
                        ]}
                        onPress={() => handleAccentColorChange(accent.color)}
                      >
                        {(user?.accentColor || '#3b82f6') === accent.color && (
                          <Ionicons name="checkmark" size={16} color="#fff" />
                        )}
                      </Pressable>
                    ))}
                  </View>
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>

      <Modal visible={showServiceModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingService ? 'Edit Service' : 'Add Service'}</Text>
              <Pressable onPress={() => setShowServiceModal(false)}>
                <Ionicons name="close" size={24} color={Colors.text.primary} />
              </Pressable>
            </View>
            <View style={styles.modalBody}>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Service Name</Text>
                <TextInput
                  style={styles.formInput}
                  value={serviceForm.name}
                  onChangeText={(text) => setServiceForm(prev => ({ ...prev, name: text }))}
                  placeholder="e.g., Strategy Consultation"
                  placeholderTextColor={Colors.text.muted}
                />
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Description</Text>
                <TextInput
                  style={[styles.formInput, styles.formTextArea]}
                  value={serviceForm.description}
                  onChangeText={(text) => setServiceForm(prev => ({ ...prev, description: text }))}
                  placeholder="Brief description of the service"
                  placeholderTextColor={Colors.text.muted}
                  multiline
                />
              </View>
              <View style={styles.formRow}>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.formLabel}>Duration (min)</Text>
                  <TextInput
                    style={styles.formInput}
                    value={serviceForm.duration}
                    onChangeText={(text) => setServiceForm(prev => ({ ...prev, duration: text }))}
                    keyboardType="numeric"
                    placeholder="60"
                    placeholderTextColor={Colors.text.muted}
                  />
                </View>
                <View style={[styles.formGroup, { flex: 1, marginLeft: 12 }]}>
                  <Text style={styles.formLabel}>Price ($)</Text>
                  <TextInput
                    style={styles.formInput}
                    value={serviceForm.price}
                    onChangeText={(text) => setServiceForm(prev => ({ ...prev, price: text }))}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={Colors.text.muted}
                  />
                </View>
              </View>
            </View>
            <View style={styles.modalFooter}>
              <Pressable style={styles.cancelButton} onPress={() => setShowServiceModal(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.saveButton} onPress={saveService} disabled={saving}>
                {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveButtonText}>Save</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showAvailabilityModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxWidth: 600 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Configure Availability</Text>
              <Pressable onPress={() => setShowAvailabilityModal(false)}>
                <Ionicons name="close" size={24} color={Colors.text.primary} />
              </Pressable>
            </View>
            <ScrollView style={styles.modalBody}>
              {availability.map((slot) => (
                <View key={slot.dayOfWeek} style={styles.availabilityRow}>
                  <Pressable 
                    style={[styles.dayToggle, slot.isActive && styles.dayToggleActive]}
                    onPress={() => updateAvailability(slot.dayOfWeek, 'isActive', !slot.isActive)}
                  >
                    <Text style={[styles.dayName, slot.isActive && styles.dayNameActive]}>{DAYS[slot.dayOfWeek]}</Text>
                  </Pressable>
                  {slot.isActive && (
                    <View style={styles.timeInputs}>
                      <TextInput
                        style={styles.timeInput}
                        value={slot.startTime}
                        onChangeText={(text) => updateAvailability(slot.dayOfWeek, 'startTime', text)}
                        placeholder="09:00"
                        placeholderTextColor={Colors.text.muted}
                      />
                      <Text style={styles.timeSeparator}>to</Text>
                      <TextInput
                        style={styles.timeInput}
                        value={slot.endTime}
                        onChangeText={(text) => updateAvailability(slot.dayOfWeek, 'endTime', text)}
                        placeholder="17:00"
                        placeholderTextColor={Colors.text.muted}
                      />
                    </View>
                  )}
                </View>
              ))}
            </ScrollView>
            <View style={styles.modalFooter}>
              <Pressable style={styles.cancelButton} onPress={() => setShowAvailabilityModal(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.saveButton} onPress={saveAvailability} disabled={saving}>
                {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveButtonText}>Save</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showBufferModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Buffer Settings</Text>
              <Pressable onPress={() => setShowBufferModal(false)}>
                <Ionicons name="close" size={24} color={Colors.text.primary} />
              </Pressable>
            </View>
            <View style={styles.modalBody}>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Buffer before appointment (min)</Text>
                <TextInput
                  style={styles.formInput}
                  value={String(bufferSettings.beforeBuffer)}
                  onChangeText={(text) => setBufferSettings(prev => ({ ...prev, beforeBuffer: parseInt(text) || 0 }))}
                  keyboardType="numeric"
                  placeholderTextColor={Colors.text.muted}
                />
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Buffer after appointment (min)</Text>
                <TextInput
                  style={styles.formInput}
                  value={String(bufferSettings.afterBuffer)}
                  onChangeText={(text) => setBufferSettings(prev => ({ ...prev, afterBuffer: parseInt(text) || 0 }))}
                  keyboardType="numeric"
                  placeholderTextColor={Colors.text.muted}
                />
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Minimum notice (min)</Text>
                <TextInput
                  style={styles.formInput}
                  value={String(bufferSettings.minimumNotice)}
                  onChangeText={(text) => setBufferSettings(prev => ({ ...prev, minimumNotice: parseInt(text) || 0 }))}
                  keyboardType="numeric"
                  placeholderTextColor={Colors.text.muted}
                />
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Max advance booking (days)</Text>
                <TextInput
                  style={styles.formInput}
                  value={String(bufferSettings.maxAdvanceBooking)}
                  onChangeText={(text) => setBufferSettings(prev => ({ ...prev, maxAdvanceBooking: parseInt(text) || 0 }))}
                  keyboardType="numeric"
                  placeholderTextColor={Colors.text.muted}
                />
              </View>
            </View>
            <View style={styles.modalFooter}>
              <Pressable style={styles.cancelButton} onPress={() => setShowBufferModal(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.saveButton} onPress={saveBufferSettings} disabled={saving}>
                {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveButtonText}>Save</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </DesktopShell>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  logoSection: { marginRight: 8 },
  logoUploadContainer: { width: 72, height: 72, borderRadius: BorderRadius.lg, backgroundColor: Colors.surface.card, borderWidth: 2, borderColor: Colors.border.subtle, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  logoPreview: { width: '100%', height: '100%', borderRadius: BorderRadius.lg },
  logoPlaceholder: { alignItems: 'center', gap: 4 },
  logoPlaceholderText: { ...Typography.small, color: Colors.text.muted, textAlign: 'center' },
  logoEditBadge: { position: 'absolute', bottom: -4, right: -4, width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.accent.cyan, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#0f0f0f' },
  title: { ...Typography.display, color: Colors.text.primary, marginBottom: 4 },
  subtitle: { ...Typography.body, color: Colors.text.tertiary },
  shareButtonsRow: { flexDirection: 'row', gap: 8 },
  shareButton: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#2563EB', paddingHorizontal: 16, paddingVertical: 10, borderRadius: BorderRadius.lg },
  viewButton: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.background.tertiary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: Colors.border.default },
  shareButtonText: { ...Typography.captionMedium, color: '#fff' },
  statsRow: { flexDirection: 'row', gap: 16, marginBottom: 24 },
  statCard: { flex: 1, borderRadius: BorderRadius.lg, overflow: 'hidden' },
  statGradient: { padding: 20, alignItems: 'center', borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: Colors.border.subtle },
  statIconContainer: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  statValue: { ...Typography.title, color: Colors.text.primary, marginTop: 12 },
  statLabel: { ...Typography.small, color: Colors.text.tertiary, marginTop: 4 },
  tabRow: { flexDirection: 'row', gap: 8, marginBottom: 24, borderBottomWidth: 1, borderBottomColor: Colors.border.subtle, paddingBottom: 12 },
  tab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: BorderRadius.md },
  tabActive: { backgroundColor: Colors.surface.card },
  tabText: { ...Typography.captionMedium, color: Colors.text.tertiary },
  tabTextActive: { color: Colors.accent.cyan },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
  section: { gap: 12, paddingBottom: 40 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { ...Typography.headline, color: Colors.text.primary },
  addButton: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.accent.cyan, paddingHorizontal: 12, paddingVertical: 8, borderRadius: BorderRadius.md },
  addButtonText: { ...Typography.small, color: '#fff', fontWeight: '600' },
  emptyState: { alignItems: 'center', paddingVertical: 60, backgroundColor: Colors.surface.card, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: Colors.border.subtle },
  emptyTitle: { ...Typography.headline, color: Colors.text.primary, marginTop: 16 },
  emptySubtitle: { ...Typography.body, color: Colors.text.tertiary, marginTop: 4 },
  bookingCard: { backgroundColor: Colors.surface.card, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: Colors.border.subtle, padding: 16 },
  bookingHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  bookingDate: { gap: 2 },
  bookingDay: { ...Typography.captionMedium, color: Colors.text.primary },
  bookingTime: { ...Typography.small, color: Colors.text.tertiary },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: BorderRadius.full },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { ...Typography.small, fontWeight: '500', textTransform: 'capitalize' },
  bookingDetails: { marginBottom: 12 },
  clientName: { ...Typography.bodyMedium, color: Colors.text.primary },
  clientEmail: { ...Typography.caption, color: Colors.text.tertiary },
  bookingFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.border.subtle },
  duration: { ...Typography.small, color: Colors.text.muted },
  amount: { ...Typography.captionMedium, color: Colors.accent.cyan },
  serviceCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface.card, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: Colors.border.subtle, padding: 16, gap: 12 },
  serviceColor: { width: 4, height: 40, borderRadius: 2 },
  serviceInfo: { flex: 1 },
  serviceName: { ...Typography.bodyMedium, color: Colors.text.primary },
  serviceMeta: { ...Typography.small, color: Colors.text.tertiary, marginTop: 2 },
  deleteButton: { padding: 8 },
  activeIndicator: { width: 8, height: 8, borderRadius: 4 },
  settingsCard: { backgroundColor: Colors.surface.card, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: Colors.border.subtle, padding: 20, marginBottom: 12 },
  settingsTitle: { ...Typography.bodyMedium, color: Colors.text.primary, marginBottom: 4 },
  settingsSubtitle: { ...Typography.caption, color: Colors.text.tertiary, marginBottom: 16 },
  settingsButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.border.subtle },
  settingsButtonText: { ...Typography.captionMedium, color: Colors.accent.cyan },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { width: '100%', maxWidth: 480, backgroundColor: Colors.surface.card, borderRadius: BorderRadius.xl, overflow: 'hidden' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: Colors.border.subtle },
  modalTitle: { ...Typography.headline, color: Colors.text.primary },
  modalBody: { padding: 20, maxHeight: 400 },
  modalFooter: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, padding: 20, borderTopWidth: 1, borderTopColor: Colors.border.subtle },
  formGroup: { marginBottom: 16 },
  formLabel: { ...Typography.captionMedium, color: Colors.text.secondary, marginBottom: 8 },
  formInput: { backgroundColor: Colors.surface.input, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border.subtle, paddingHorizontal: 14, paddingVertical: 12, color: Colors.text.primary, fontSize: 15 },
  formTextArea: { minHeight: 80, textAlignVertical: 'top' },
  formRow: { flexDirection: 'row' },
  cancelButton: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border.subtle },
  cancelButtonText: { ...Typography.captionMedium, color: Colors.text.secondary },
  saveButton: { backgroundColor: Colors.accent.cyan, paddingHorizontal: 24, paddingVertical: 12, borderRadius: BorderRadius.md, minWidth: 80, alignItems: 'center' },
  saveButtonText: { ...Typography.captionMedium, color: '#fff' },
  availabilityRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 12 },
  dayToggle: { width: 100, paddingVertical: 10, paddingHorizontal: 12, borderRadius: BorderRadius.md, backgroundColor: Colors.surface.input, borderWidth: 1, borderColor: Colors.border.subtle },
  dayToggleActive: { backgroundColor: Colors.accent.cyan, borderColor: Colors.accent.cyan },
  dayName: { ...Typography.captionMedium, color: Colors.text.tertiary },
  dayNameActive: { color: '#fff' },
  timeInputs: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  timeInput: { flex: 1, backgroundColor: Colors.surface.input, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border.subtle, paddingHorizontal: 12, paddingVertical: 10, color: Colors.text.primary, fontSize: 14, textAlign: 'center' },
  timeSeparator: { ...Typography.caption, color: Colors.text.muted },
  colorPickerContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 16 },
  colorOption: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'transparent' },
  colorOptionSelected: { borderColor: '#fff', shadowColor: '#fff', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 8, elevation: 4 },
});
