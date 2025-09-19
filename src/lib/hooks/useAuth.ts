'use client'
import { useEffect, useState } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase } from '../supabase'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<any>(null)

  useEffect(() => {
    getUser()
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session?.user?.id)
        setUser(session?.user ?? null)
        if (session?.user) {
          await loadOrCreateProfile(session.user)
        } else {
          setProfile(null)
        }
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  async function getUser() {
    const { data: { session } } = await supabase.auth.getSession()
    console.log('Initial session:', session?.user?.id)
    setUser(session?.user ?? null)
    if (session?.user) {
      await loadOrCreateProfile(session.user)
    }
    setLoading(false)
  }

  async function loadOrCreateProfile(user: User) {
    console.log('Loading profile for user:', user.id)
    
    try {
      // First, try to load existing profile
      const { data: existingProfile, error: selectError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()
      
      console.log('Profile query result:', {
        data: existingProfile,
        error: selectError,
        errorCode: selectError?.code,
        errorMessage: selectError?.message,
        errorDetails: selectError?.details
      })
      
      // If we found an existing profile, use it
      if (existingProfile) {
        setProfile(existingProfile)
        return
      }

      // If there was an error other than "no rows found", log and return
      if (selectError) {
        console.error('Error loading profile - Code:', selectError.code, 'Message:', selectError.message)
        console.error('Full error object:', JSON.stringify(selectError, null, 2))
        return
      }

      // If no profile exists and no error, create one
      console.log('No existing profile found, creating new profile for:', user.email)
      
      // Check for pending profile data from the join form
      let pendingProfile = null
      try {
        const storedData = localStorage.getItem('pendingProfile')
        if (storedData) {
          pendingProfile = JSON.parse(storedData)
          console.log('Found pending profile data:', pendingProfile)
          // Clear it after reading
          localStorage.removeItem('pendingProfile')
        }
      } catch (error) {
        console.error('Error reading pending profile:', error)
      }

      // Use pending profile data if available, otherwise fallback to user metadata
      const profileData = {
        id: user.id,
        email: user.email || '',
        full_name: pendingProfile?.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
        dietary_preferences: pendingProfile?.dietary_preferences || null,
      }

      console.log('Attempting to create profile with data:', profileData)

      const { data: newProfile, error: insertError } = await supabase
        .from('profiles')
        .insert(profileData)
        .select()
        .single()

      console.log('Profile creation result:', {
        data: newProfile,
        error: insertError,
        errorCode: insertError?.code,
        errorMessage: insertError?.message,
        errorDetails: insertError?.details
      })

      if (insertError) {
        console.error('Profile creation failed - Code:', insertError.code, 'Message:', insertError.message)
        console.error('Full insert error:', JSON.stringify(insertError, null, 2))
        return
      }
      
      if (newProfile) {
        setProfile(newProfile)
        console.log('Profile created successfully:', newProfile)
      } else {
        console.error('Profile creation returned no data and no error - unexpected state')
      }

    } catch (error) {
      console.error('Unexpected error in loadOrCreateProfile:', error)
      console.error('Error type:', typeof error)
      console.error('Error stringified:', JSON.stringify(error, null, 2))
    }
  }

  return { 
    user, 
    loading, 
    profile, 
    isAdmin: profile?.role === 'admin' 
  }
}