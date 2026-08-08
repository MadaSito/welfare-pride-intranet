import { useAuth } from "@/_core/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Building2, Camera, Mail, MapPin, Phone, RefreshCw, Search, ShieldAlert, SlidersHorizontal, UserRound, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type DirectoryProfile = NonNullable<ReturnType<typeof useDirectoryData>["profiles"]>[number];

function useDirectoryData() {
  const query = trpc.profiles.list.useQuery();
  return { ...query, profiles: query.data?.items };
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join("") || "WP";
}

export default function People() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const directory = useDirectoryData();
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState("all");
  const [selected, setSelected] = useState<DirectoryProfile | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState({ displayName: "", jobTitle: "", department: "", officeLocation: "", bio: "", phone: "" });
  const deepLinkedProfileId = useMemo(() => {
    if (typeof window === "undefined") return null;
    const value = Number(new URLSearchParams(window.location.search).get("employee"));
    return Number.isInteger(value) && value > 0 ? value : null;
  }, []);

  const updateMe = trpc.profiles.updateMe.useMutation({
    onSuccess: async () => {
      await Promise.all([utils.profiles.list.invalidate(), utils.profiles.me.invalidate()]);
      toast.success("Your Welfare Pride profile was updated.");
      setEditOpen(false);
    },
    onError: error => toast.error(error.message),
  });
  const adminUpdate = trpc.profiles.adminUpdate.useMutation({
    onSuccess: async () => {
      await utils.profiles.list.invalidate();
      toast.success("Employee profile updated.");
      setEditOpen(false);
    },
    onError: error => toast.error(error.message),
  });
  const uploadMyPhoto = trpc.profiles.uploadMyPhoto.useMutation({
    onSuccess: async () => {
      await Promise.all([utils.profiles.list.invalidate(), utils.profiles.me.invalidate()]);
      toast.success("Profile photograph updated.");
    },
    onError: error => toast.error(error.message),
  });
  const adminUploadPhoto = trpc.profiles.adminUploadPhoto.useMutation({
    onSuccess: async () => {
      await utils.profiles.list.invalidate();
      toast.success("Employee photograph updated.");
    },
    onError: error => toast.error(error.message),
  });
  const syncDirectory = trpc.profiles.syncDirectory.useMutation({
    onSuccess: async result => {
      await utils.profiles.list.invalidate();
      toast.success(`${result.synchronized} Microsoft Entra profiles synchronized.`);
    },
    onError: error => toast.error(error.message),
  });

  const departments = useMemo(
    () => Array.from(new Set((directory.profiles || []).map(profile => profile.department).filter(Boolean) as string[])).sort(),
    [directory.profiles],
  );
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return (directory.profiles || []).filter(profile => {
      const matchesDepartment = department === "all" || profile.department === department;
      const haystack = `${profile.displayName} ${profile.jobTitle || ""} ${profile.department || ""} ${profile.email || ""}`.toLowerCase();
      return matchesDepartment && (!normalized || haystack.includes(normalized));
    });
  }, [department, directory.profiles, query]);

  useEffect(() => {
    if (!selected || !directory.profiles) return;
    const refreshed = directory.profiles.find(profile => profile.id === selected.id);
    if (refreshed) setSelected(refreshed);
  }, [directory.profiles, selected]);

  useEffect(() => {
    if (!deepLinkedProfileId || !directory.profiles) return;
    const profile = directory.profiles.find(item => item.id === deepLinkedProfileId);
    if (profile) setSelected(profile);
  }, [deepLinkedProfileId, directory.profiles]);

  function openEditor(profile: DirectoryProfile) {
    setSelected(profile);
    setForm({
      displayName: profile.displayName,
      jobTitle: profile.jobTitle || "",
      department: profile.department || "",
      officeLocation: profile.officeLocation || "",
      bio: profile.bio || "",
      phone: profile.phone || "",
    });
    setEditOpen(true);
  }

  async function readPhoto(file: File | undefined, profile: DirectoryProfile) {
    if (!file) return;
    if (!file.type.match(/^image\/(png|jpeg|webp)$/)) {
      toast.error("Use a PNG, JPEG, or WebP image.");
      return;
    }
    if (file.size > 4_000_000) {
      toast.error("Profile photographs must be 4 MB or smaller.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      if (profile.userId === user?.id) uploadMyPhoto.mutate({ dataUrl });
      else if (user?.role === "admin") adminUploadPhoto.mutate({ profileId: profile.id, dataUrl });
    };
    reader.readAsDataURL(file);
  }

  function submitProfile() {
    if (!selected) return;
    if (user?.role === "admin") {
      adminUpdate.mutate({
        profileId: selected.id,
        displayName: form.displayName,
        jobTitle: form.jobTitle || null,
        department: form.department || null,
        officeLocation: form.officeLocation || null,
        bio: form.bio || null,
        phone: form.phone || null,
      });
    } else {
      updateMe.mutate({ bio: form.bio || null, phone: form.phone || null });
    }
  }

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Find your people"
        title="Employee Directory"
        description="Search the Welfare Pride team, open profile details, and keep your approved contact information current."
        icon={Users}
        actions={user?.role === "admin" ? (
          <Button onClick={() => syncDirectory.mutate()} disabled={syncDirectory.isPending} className="bg-[#5A92C9] text-white hover:bg-[#5A92C9]/90">
            <RefreshCw className={`mr-2 h-4 w-4 ${syncDirectory.isPending ? "animate-spin" : ""}`} /> Synchronize directory
          </Button>
        ) : undefined}
      />

      {directory.data?.status === "unconfigured" ? (
        <Alert className="border-[#D58240]/25 bg-[#D58240]/5">
          <ShieldAlert className="h-4 w-4 text-[#D58240]" />
          <AlertTitle>Microsoft Entra ID connection required</AlertTitle>
          <AlertDescription>{directory.data.message} Your signed-in portal profile remains available for self-service editing.</AlertDescription>
        </Alert>
      ) : null}
      {directory.data?.status === "degraded" ? (
        <Alert className="border-[#D58240]/25 bg-[#D58240]/5">
          <ShieldAlert className="h-4 w-4 text-[#D58240]" />
          <AlertTitle>Showing the last synchronized directory</AlertTitle>
          <AlertDescription>{directory.data.message}</AlertDescription>
        </Alert>
      ) : null}
      {directory.error ? (
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Employee directory could not be loaded</AlertTitle>
          <AlertDescription>{directory.error.message}</AlertDescription>
        </Alert>
      ) : null}

      <Card className="border-0 shadow-soft">
        <CardContent className="grid gap-4 p-4 md:grid-cols-[1fr_260px] md:p-5">
          <label className="relative block">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search by name, title, department, or email" className="h-11 pl-10" />
          </label>
          <label className="relative block">
            <SlidersHorizontal className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <select value={department} onChange={event => setDepartment(event.target.value)} className="h-11 w-full appearance-none rounded-md border border-input bg-white pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-[#5A92C9]/30">
              <option value="all">All departments</option>
              {departments.map(item => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
        </CardContent>
      </Card>

      {directory.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-56 rounded-2xl" />)}</div>
      ) : filtered.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map(profile => (
            <button key={profile.id} onClick={() => setSelected(profile)} className="group rounded-2xl border border-border/80 bg-white p-5 text-left shadow-sm hover:-translate-y-0.5 hover:border-[#5A92C9]/35 hover:shadow-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5A92C9]">
              <div className="flex items-start gap-4">
                <Avatar className="h-14 w-14 border-2 border-[#5A92C9]/15">
                  <AvatarImage src={profile.photoUrl || undefined} alt="" />
                  <AvatarFallback className="bg-[#5A92C9]/10 font-bold text-[#376F9F]">{initials(profile.displayName)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate font-bold">{profile.displayName}</h2>
                    {profile.userId === user?.id ? <Badge className="border-0 bg-[#5A92C9]/10 text-[10px] text-[#376F9F] hover:bg-[#5A92C9]/10">You</Badge> : null}
                  </div>
                  <p className="mt-1 truncate text-sm text-muted-foreground">{profile.jobTitle || "Welfare Pride employee"}</p>
                  <p className="mt-1 truncate text-xs font-medium text-[#D58240]">{profile.department || "Department not provided"}</p>
                </div>
              </div>
              <div className="mt-5 space-y-2 border-t border-border/70 pt-4 text-xs text-muted-foreground">
                <p className="flex items-center gap-2 truncate"><Mail className="h-3.5 w-3.5 text-[#5A92C9]" />{profile.email || "Email not provided"}</p>
                <p className="flex items-center gap-2 truncate"><MapPin className="h-3.5 w-3.5 text-[#5A92C9]" />{profile.officeLocation || "Location not provided"}</p>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-[#5A92C9]/30 bg-white px-6 py-14 text-center">
          <UserRound className="mx-auto h-8 w-8 text-[#5A92C9]" />
          <h2 className="mt-4 font-bold">No employees match this view</h2>
          <p className="mt-2 text-sm text-muted-foreground">Adjust the search or department filter, or ask an administrator to synchronize Microsoft Entra ID.</p>
        </div>
      )}

      <Dialog open={Boolean(selected) && !editOpen} onOpenChange={open => !open && setSelected(null)}>
        <DialogContent className="max-w-lg">
          {selected ? (
            <>
              <DialogHeader>
                <div className="mb-3 flex items-center gap-4">
                  <Avatar className="h-16 w-16 border-2 border-[#5A92C9]/15">
                    <AvatarImage src={selected.photoUrl || undefined} alt="" />
                    <AvatarFallback className="bg-[#5A92C9]/10 font-bold text-[#376F9F]">{initials(selected.displayName)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <DialogTitle className="truncate text-xl">{selected.displayName}</DialogTitle>
                    <DialogDescription className="mt-1">{selected.jobTitle || "Welfare Pride employee"}</DialogDescription>
                  </div>
                </div>
              </DialogHeader>
              <div className="space-y-4 text-sm">
                {selected.bio ? <p className="rounded-xl bg-muted/60 p-4 leading-6">{selected.bio}</p> : null}
                <div className="grid gap-3 sm:grid-cols-2">
                  <p className="flex items-start gap-2"><Building2 className="mt-0.5 h-4 w-4 text-[#5A92C9]" /><span>{selected.department || "Department not provided"}</span></p>
                  <p className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 text-[#5A92C9]" /><span>{selected.officeLocation || "Location not provided"}</span></p>
                  <p className="flex items-start gap-2"><Mail className="mt-0.5 h-4 w-4 text-[#5A92C9]" /><span className="break-all">{selected.email || "Email not provided"}</span></p>
                  <p className="flex items-start gap-2"><Phone className="mt-0.5 h-4 w-4 text-[#5A92C9]" /><span>{selected.phone || "Phone not provided"}</span></p>
                </div>
              </div>
              {(selected.userId === user?.id || user?.role === "admin") ? (
                <DialogFooter className="mt-2 flex-row justify-end gap-2">
                  <label className="inline-flex">
                    <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={event => void readPhoto(event.target.files?.[0], selected)} />
                    <span className="inline-flex h-9 cursor-pointer items-center rounded-md border border-input bg-white px-3 text-sm font-medium hover:bg-accent"><Camera className="mr-2 h-4 w-4" />Update photo</span>
                  </label>
                  <Button onClick={() => openEditor(selected)} className="bg-[#5A92C9] text-white hover:bg-[#5A92C9]/90">Edit profile</Button>
                </DialogFooter>
              ) : null}
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{user?.role === "admin" ? "Edit employee profile" : "Edit my profile"}</DialogTitle>
            <DialogDescription>{user?.role === "admin" ? "Administrator changes override portal profile fields. Microsoft Entra synchronization may refresh directory-owned values." : "You can update your biography and phone number. Directory-owned values remain synchronized from Microsoft Entra ID."}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="profile-name">Display name</Label><Input id="profile-name" value={form.displayName} disabled={user?.role !== "admin"} onChange={event => setForm(current => ({ ...current, displayName: event.target.value }))} /></div>
            <div className="space-y-2"><Label htmlFor="profile-title">Job title</Label><Input id="profile-title" value={form.jobTitle} disabled={user?.role !== "admin"} onChange={event => setForm(current => ({ ...current, jobTitle: event.target.value }))} /></div>
            <div className="space-y-2"><Label htmlFor="profile-department">Department</Label><Input id="profile-department" value={form.department} disabled={user?.role !== "admin"} onChange={event => setForm(current => ({ ...current, department: event.target.value }))} /></div>
            <div className="space-y-2"><Label htmlFor="profile-office">Office location</Label><Input id="profile-office" value={form.officeLocation} disabled={user?.role !== "admin"} onChange={event => setForm(current => ({ ...current, officeLocation: event.target.value }))} /></div>
            <div className="space-y-2"><Label htmlFor="profile-phone">Phone</Label><Input id="profile-phone" value={form.phone} onChange={event => setForm(current => ({ ...current, phone: event.target.value }))} /></div>
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="profile-bio">Biography</Label><Textarea id="profile-bio" value={form.bio} rows={6} maxLength={3000} onChange={event => setForm(current => ({ ...current, bio: event.target.value }))} /><p className="text-right text-xs text-muted-foreground">{form.bio.length}/3000</p></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={submitProfile} disabled={updateMe.isPending || adminUpdate.isPending} className="bg-[#5A92C9] text-white hover:bg-[#5A92C9]/90">Save changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
