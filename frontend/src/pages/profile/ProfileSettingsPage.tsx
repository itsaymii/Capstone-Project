import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { NavigationBar } from '../../components/NavigationBar'
import {
  getCurrentUserProfile,
  updateCurrentUserAvatar,
  updateCurrentUserPersonalInfo,
  updateCurrentUserProfile,
} from '../../services/auth'

const barangayOptions = [
  'Barangay 1',
  'Barangay 2',
  'Barangay 3',
  'Barangay 4',
  'Barangay 5',
  'Barangay 6',
  'Barangay 7',
  'Barangay 8',
  'Barangay 9',
  'Barangay 10',
]

const cityOptions = ['Lucena City', 'Tayabas City', 'Sariaya', 'Candelaria', 'Pagbilao']

const provinceOptions = ['Quezon', 'Batangas', 'Laguna', 'Cavite']

type ProfileSettingsPageProps = {
  variant?: 'citizen' | 'admin'
}

export function ProfileSettingsPage({ variant = 'citizen' }: ProfileSettingsPageProps) {
  const navigate = useNavigate()
  const isAdminVariant = variant === 'admin'
  const [isEditing, setIsEditing] = useState(false)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null)
  const [phoneNumber, setPhoneNumber] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [gender, setGender] = useState('')
  const [addressLine1, setAddressLine1] = useState('')
  const [barangay, setBarangay] = useState('')
  const [city, setCity] = useState('')
  const [province, setProvince] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [emergencyContactName, setEmergencyContactName] = useState('')
  const [emergencyContactNumber, setEmergencyContactNumber] = useState('')
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  function populateProfileFields(): void {
    const profile = getCurrentUserProfile()
    if (!profile) {
      return
    }

    setFullName(profile.fullName)
    setEmail(profile.email)
    setPhotoPreviewUrl(profile.photoUrl ?? null)
    setPhoneNumber(profile.phoneNumber ?? '')
    setBirthDate(profile.birthDate ?? '')
    setGender(profile.gender ?? '')
    setAddressLine1(profile.addressLine1 ?? profile.address ?? '')
    setBarangay(profile.barangay ?? '')
    setCity(profile.city ?? '')
    setProvince(profile.province ?? '')
    setPostalCode(profile.postalCode ?? '')
    setEmergencyContactName(profile.emergencyContactName ?? '')
    setEmergencyContactNumber(profile.emergencyContactNumber ?? '')
  }

  useEffect(() => {
    populateProfileFields()
  }, [])

  function handleSelectPhoto(): void {
    if (!isEditing) {
      return
    }
    fileInputRef.current?.click()
  }

  function handlePhotoFileChange(event: ChangeEvent<HTMLInputElement>): void {
    if (!isEditing) {
      event.target.value = ''
      return
    }

    const selectedFile = event.target.files?.[0]
    if (!selectedFile) {
      return
    }

    if (!selectedFile.type.startsWith('image/')) {
      setErrorMessage('Please select an image file.')
      setStatusMessage('')
      event.target.value = ''
      return
    }

    // Keep avatar lightweight in web storage.
    const maxFileSizeBytes = 2 * 1024 * 1024
    if (selectedFile.size > maxFileSizeBytes) {
      setErrorMessage('Please select an image under 2MB.')
      setStatusMessage('')
      event.target.value = ''
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const nextPreview = typeof reader.result === 'string' ? reader.result : null
      setPhotoPreviewUrl(nextPreview)
      setErrorMessage('')
      setStatusMessage('Profile picture ready. Click Save Changes to apply.')
    }
    reader.onerror = () => {
      setErrorMessage('Unable to read the selected image. Please try another file.')
      setStatusMessage('')
    }
    reader.readAsDataURL(selectedFile)
    event.target.value = ''
  }

  function handleRemovePhoto(): void {
    if (!isEditing) {
      return
    }

    setPhotoPreviewUrl(null)
    setErrorMessage('')
    setStatusMessage('Profile picture removed. Click Save Changes to apply.')
  }

  function handleStartEditing(): void {
    setStatusMessage('')
    setErrorMessage('')
    setIsEditing(true)
  }

  function handleCancelEditing(): void {
    populateProfileFields()
    setStatusMessage('')
    setErrorMessage('')
    setIsEditing(false)
  }

  const profileInitials = useMemo(() => {
    const segments = fullName
      .trim()
      .split(/\s+/)
      .filter(Boolean)

    if (segments.length === 0) {
      return 'U'
    }

    if (segments.length === 1) {
      return segments[0].slice(0, 2).toUpperCase()
    }

    return `${segments[0][0]}${segments[1][0]}`.toUpperCase()
  }, [fullName])

  const editableFieldClass =
    'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100'
  const readOnlyFieldClass =
    'w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-600 shadow-inner outline-none'
  const fieldClassName = isEditing ? editableFieldClass : readOnlyFieldClass
  const pageClassName = isAdminVariant
    ? 'min-h-screen bg-[#181c23] text-slate-100'
    : 'min-h-screen bg-gradient-to-br from-slate-100 via-sky-50 to-slate-200 text-slate-800'
  const containerClassName = isAdminVariant
    ? 'mx-auto w-full max-w-5xl px-6 py-8 sm:px-8'
    : 'mx-auto w-full max-w-5xl px-6 py-10 sm:px-8'
  const sectionClassName = isAdminVariant
    ? 'rounded-3xl border border-slate-700 bg-[#232837] p-6 shadow-[0_18px_45px_-24px_rgba(0,0,0,0.55)] sm:p-8'
    : 'rounded-3xl border border-white/70 bg-white/90 p-6 shadow-[0_18px_45px_-24px_rgba(15,23,42,0.45)] backdrop-blur sm:p-8'
  const headingToneClassName = isAdminVariant ? 'text-slate-100' : 'text-slate-900'
  const subTextClassName = isAdminVariant ? 'text-slate-400' : 'text-slate-600'
  const surfaceClassName = isAdminVariant
    ? 'rounded-2xl border border-slate-700 bg-[#1d2230] p-4 shadow-sm'
    : 'rounded-2xl border border-slate-200 bg-white p-4 shadow-sm'
  const accentSurfaceClassName = isAdminVariant
    ? 'mt-6 flex items-center gap-4 rounded-2xl border border-slate-700 bg-[#1d2230] p-4 shadow-sm'
    : 'mt-6 flex items-center gap-4 rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-50 via-white to-sky-50 p-4 shadow-sm'

  function handleSaveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!isEditing) {
      return
    }

    const updated = updateCurrentUserProfile(fullName)
    const avatarUpdated = updateCurrentUserAvatar(photoPreviewUrl)
    const personalInfoUpdated = updateCurrentUserPersonalInfo({
      phoneNumber,
      birthDate,
      gender,
      addressLine1,
      barangay,
      city,
      province,
      postalCode,
      emergencyContactName,
      emergencyContactNumber,
    })

    if (!updated || !avatarUpdated || !personalInfoUpdated) {
      setErrorMessage('Unable to update profile right now. Please try again.')
      setStatusMessage('')
      return
    }

    setErrorMessage('')
    setStatusMessage('Profile settings saved successfully.')
    setIsEditing(false)
  }

  return (
    <main className={pageClassName}>
      {isAdminVariant ? (
        <div className="border-b border-slate-800 bg-[#181c23]">
          <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5 sm:px-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Admin Panel</p>
              <h1 className="mt-1 text-2xl font-black text-white">Profile Settings</h1>
            </div>
            <button
              className="rounded-xl border border-slate-700 bg-[#232837] px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-blue-500 hover:text-white"
              onClick={() => navigate('/admin-dashboard')}
              type="button"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      ) : (
        <NavigationBar variant="hero" />
      )}

      <div className={containerClassName}>
        <section className={sectionClassName}>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Account</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className={`text-3xl font-black sm:text-4xl ${headingToneClassName}`}>Profile Settings</h1>
            <span
              className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] ${
                isEditing ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 bg-slate-100 text-slate-600'
              }`}
            >
              {isEditing ? 'Editing' : 'View Only'}
            </span>
          </div>
          <p className={`mt-2 text-sm ${subTextClassName}`}>Manage your account details used across the DRRMO portal.</p>

          <div className={accentSurfaceClassName}>
            {photoPreviewUrl ? (
              <img alt="Profile" className="h-14 w-14 rounded-full border-2 border-white object-cover shadow" src={photoPreviewUrl} />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#0b2a57] text-lg font-bold text-white shadow">
                {profileInitials}
              </div>
            )}
            <div>
              <p className={`text-sm font-semibold ${headingToneClassName}`}>{fullName || 'User Profile'}</p>
              <p className={`text-xs ${subTextClassName}`}>{email || 'No email found'}</p>
            </div>
          </div>

          <div className={`mt-4 ${surfaceClassName}`}>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Profile Picture</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                className="inline-flex rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!isEditing}
                onClick={handleSelectPhoto}
                type="button"
              >
                Upload Picture
              </button>
              <button
                className="inline-flex rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!isEditing || !photoPreviewUrl}
                onClick={handleRemovePhoto}
                type="button"
              >
                Remove
              </button>
              <span className="text-xs text-slate-500">PNG/JPG up to 2MB</span>
            </div>
            <input
              accept="image/*"
              className="hidden"
              onChange={handlePhotoFileChange}
              ref={fileInputRef}
              type="file"
            />
          </div>

          <form className="mt-6 space-y-5" onSubmit={handleSaveProfile}>
            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Full Name</span>
              <input
                className={fieldClassName}
                type="text"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Enter your full name"
                disabled={!isEditing}
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Email</span>
              <input
                className="w-full rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-600 outline-none"
                type="email"
                value={email}
                disabled
                readOnly
              />
            </label>

            <div className="grid gap-5 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Phone Number</span>
                <input
                  className={fieldClassName}
                  type="tel"
                  value={phoneNumber}
                  onChange={(event) => setPhoneNumber(event.target.value)}
                  placeholder="09XX XXX XXXX"
                  disabled={!isEditing}
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Birth Date</span>
                <input
                  className={fieldClassName}
                  type="date"
                  value={birthDate}
                  onChange={(event) => setBirthDate(event.target.value)}
                  disabled={!isEditing}
                />
              </label>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Gender</span>
                <select
                  className={fieldClassName}
                  value={gender}
                  onChange={(event) => setGender(event.target.value)}
                  disabled={!isEditing}
                >
                  <option value="">Prefer not to say</option>
                  <option value="Female">Female</option>
                  <option value="Male">Male</option>
                  <option value="Non-binary">Non-binary</option>
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Postal Code</span>
                <input
                  className={fieldClassName}
                  type="text"
                  value={postalCode}
                  onChange={(event) => setPostalCode(event.target.value)}
                  placeholder="4301"
                  disabled={!isEditing}
                />
              </label>
            </div>

            <div className={isAdminVariant ? 'rounded-2xl border border-slate-700 bg-[#1d2230] p-4 shadow-sm' : 'rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white p-4 shadow-sm'}>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Address Information</p>
              <div className="mt-3 grid gap-5 sm:grid-cols-2">
                <label className="block sm:col-span-2">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Street / House No.</span>
                  <input
                    className={fieldClassName}
                    type="text"
                    value={addressLine1}
                    onChange={(event) => setAddressLine1(event.target.value)}
                    placeholder="Blk/Lot, Street, Subdivision"
                    disabled={!isEditing}
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Barangay</span>
                  <select
                    className={fieldClassName}
                    value={barangay}
                    onChange={(event) => setBarangay(event.target.value)}
                    disabled={!isEditing}
                  >
                    <option value="">Select barangay</option>
                    {barangayOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">City / Municipality</span>
                  <select
                    className={fieldClassName}
                    value={city}
                    onChange={(event) => setCity(event.target.value)}
                    disabled={!isEditing}
                  >
                    <option value="">Select city/municipality</option>
                    {cityOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block sm:col-span-2">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Province</span>
                  <select
                    className={fieldClassName}
                    value={province}
                    onChange={(event) => setProvince(event.target.value)}
                    disabled={!isEditing}
                  >
                    <option value="">Select province</option>
                    {provinceOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <div className={isAdminVariant ? 'rounded-2xl border border-slate-700 bg-[#1d2230] p-4 shadow-sm' : 'rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white p-4 shadow-sm'}>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Emergency Contact</p>
              <div className="mt-3 grid gap-5 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Contact Name</span>
                  <input
                    className={fieldClassName}
                    type="text"
                    value={emergencyContactName}
                    onChange={(event) => setEmergencyContactName(event.target.value)}
                    placeholder="Full name"
                    disabled={!isEditing}
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Contact Number</span>
                  <input
                    className={fieldClassName}
                    type="tel"
                    value={emergencyContactNumber}
                    onChange={(event) => setEmergencyContactNumber(event.target.value)}
                    placeholder="09XX XXX XXXX"
                    disabled={!isEditing}
                  />
                </label>
              </div>
            </div>

            {!isEditing ? (
              <button
                className="inline-flex rounded-xl bg-[#0b2a57] px-4 py-2.5 text-sm font-semibold text-white shadow transition hover:bg-[#0a2449]"
                onClick={handleStartEditing}
                type="button"
              >
                Edit Profile
              </button>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  className="inline-flex rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white shadow transition hover:bg-blue-600"
                  type="submit"
                >
                  Save Changes
                </button>
                <button
                  className="inline-flex rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  onClick={handleCancelEditing}
                  type="button"
                >
                  Cancel
                </button>
              </div>
            )}

            {statusMessage ? (
              <p className="rounded-lg border border-[#0b2a57]/20 bg-gradient-to-r from-[#0b2a57]/5 via-white to-sky-50 px-3 py-2 text-sm font-medium text-[#0b2a57]">
                {statusMessage}
              </p>
            ) : null}

            {errorMessage ? (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{errorMessage}</p>
            ) : null}
          </form>
        </section>
      </div>
    </main>
  )
}
