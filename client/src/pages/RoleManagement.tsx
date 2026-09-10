import { PageHeader } from "@/components/PageHeader";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { KeyRound, Loader2, ShieldAlert, UserCog, UsersRound } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const permissionLabels = {
  manage_content: "Manage content",
  approve_submissions: "Approve employee submissions",
  manage_resources: "Manage pages and resources",
  manage_backups: "Manage backups",
  view_audit: "View audit history",
  manage_email: "Manage email templates and delivery",
  manage_users: "Manage user lifecycle",
  manage_roles: "Manage roles",
} as const;
type Permission = keyof typeof permissionLabels;
const permissions = Object.keys(permissionLabels) as Permission[];

export default function RoleManagement() {
  const overview = trpc.rbac.overview.useQuery();
  const utils = trpc.useUtils();
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [roleName, setRoleName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState<Permission[]>(["manage_content"]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const roles = overview.data?.roles || [];
  const assignments = overview.data?.assignments || [];
  const users = overview.data?.users || [];
  const saveRole = trpc.rbac.saveRole.useMutation({ onSuccess: async () => { await utils.rbac.overview.invalidate(); toast.success("Portal role saved."); }, onError: error => toast.error(error.message) });
  const setUserRoles = trpc.rbac.setUserRoles.useMutation({ onSuccess: async () => { await utils.rbac.overview.invalidate(); toast.success("User role assignments saved."); }, onError: error => toast.error(error.message) });
  const selectedUserRoleIds = useMemo(() => selectedUserId ? assignments.filter(item => item.userId === selectedUserId).map(item => item.roleId) : [], [assignments, selectedUserId]);

  function selectRole(id: number | null) {
    const role = roles.find(item => item.id === id);
    setSelectedRoleId(id);
    setRoleName(role?.name || "");
    setDescription(role?.description || "");
    try { setSelectedPermissions(role ? JSON.parse(role.permissionsJson) : ["manage_content"]); } catch { setSelectedPermissions(["manage_content"]); }
  }
  function togglePermission(value: Permission) { setSelectedPermissions(current => current.includes(value) ? current.filter(item => item !== value) : [...current, value]); }
  function toggleUserRole(roleId: number) {
    if (!selectedUserId) return;
    const next = selectedUserRoleIds.includes(roleId) ? selectedUserRoleIds.filter(id => id !== roleId) : [...selectedUserRoleIds, roleId];
    setUserRoles.mutate({ userId: selectedUserId, roleIds: next });
  }

  return <div className="space-y-7">
    <PageHeader eyebrow="Administration" title="Roles & Permissions" description="Assign the built-in Intranet Portal Manager role or create custom permission sets. Server-side checks enforce every permission." icon={UsersRound} />
    <Alert className="border-[#5A92C9]/25 bg-[#5A92C9]/5"><ShieldAlert className="h-4 w-4 text-[#5A92C9]" /><AlertTitle>Least privilege</AlertTitle><AlertDescription>Administrators retain full access. Portal roles grant only the listed operational permissions and never replace local MFA, Entra policy, or resource-level access checks.</AlertDescription></Alert>
    {overview.error ? <Alert variant="destructive"><ShieldAlert className="h-4 w-4" /><AlertTitle>Role data could not be loaded</AlertTitle><AlertDescription>{overview.error.message}</AlertDescription></Alert> : null}
    <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
      <Card className="border-0 shadow-soft"><CardHeader className="flex-row items-center justify-between"><CardTitle>Portal roles</CardTitle><Button size="sm" variant="outline" onClick={() => selectRole(null)}>New role</Button></CardHeader><CardContent className="space-y-2">{roles.map(role => <button key={role.id} onClick={() => selectRole(role.id)} className={`w-full rounded-xl border p-3 text-left ${selectedRoleId === role.id ? "border-[#5A92C9]/45 bg-[#5A92C9]/8" : "border-border hover:bg-muted/60"}`}><div className="flex items-center justify-between gap-2"><p className="font-semibold">{role.name}</p>{role.isSystem ? <Badge variant="outline" className="border-[#D58240]/25 bg-[#D58240]/5 text-[#9A5727]">Built in</Badge> : <Badge variant="outline">Custom</Badge>}</div><p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{role.description || "No description"}</p></button>)}</CardContent></Card>
      <Card className="border-0 shadow-soft"><CardHeader><CardTitle>{selectedRoleId ? "Edit role" : "Create custom role"}</CardTitle></CardHeader><CardContent className="space-y-5"><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Role name</Label><Input value={roleName} onChange={event => setRoleName(event.target.value)} placeholder="Communications Publisher" /></div><div className="space-y-2"><Label>Permission count</Label><div className="flex h-10 items-center rounded-md border border-input bg-muted/30 px-3 text-sm">{selectedPermissions.length} selected</div></div></div><div className="space-y-2"><Label>Description</Label><Textarea value={description} onChange={event => setDescription(event.target.value)} placeholder="What may members of this role manage?" /></div><div className="grid gap-3 sm:grid-cols-2">{permissions.map(permission => <label key={permission} className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-3"><Checkbox checked={selectedPermissions.includes(permission)} onCheckedChange={() => togglePermission(permission)} /><span><span className="block text-sm font-semibold">{permissionLabels[permission]}</span><span className="mt-1 block text-xs text-muted-foreground">{permission.replaceAll("_", " ")}</span></span></label>)}</div><Button className="bg-[#5A92C9] text-white hover:bg-[#5A92C9]/90" disabled={!roleName || !selectedPermissions.length || saveRole.isPending} onClick={() => saveRole.mutate({ id: selectedRoleId || undefined, name: roleName, description: description || null, permissions: selectedPermissions })}>{saveRole.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}Save role</Button></CardContent></Card>
    </div>
    <Card className="border-0 shadow-soft"><CardHeader><CardTitle>Assign portal roles</CardTitle><p className="mt-1 text-sm text-muted-foreground">Local and enterprise users remain standard users unless explicitly assigned a portal role. Users can have more than one role.</p></CardHeader><CardContent className="grid gap-5 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)]"><div className="space-y-2"><Label>Portal user</Label><select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={selectedUserId || ""} onChange={event => setSelectedUserId(event.target.value ? Number(event.target.value) : null)}><option value="">Select a user</option>{users.map(user => <option key={user.id} value={user.id}>{user.name || user.email || `User ${user.id}`} · {user.loginMethod || "local"}</option>)}</select></div><div className="grid gap-3 sm:grid-cols-2">{selectedUserId ? roles.map(role => <label key={role.id} className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-3"><Checkbox checked={selectedUserRoleIds.includes(role.id)} disabled={setUserRoles.isPending} onCheckedChange={() => toggleUserRole(role.id)} /><span><span className="block text-sm font-semibold">{role.name}</span><span className="mt-1 block text-xs text-muted-foreground">{role.description || "Custom portal role"}</span></span></label>) : <div className="rounded-xl border border-dashed border-[#5A92C9]/30 bg-[#5A92C9]/5 p-5 text-sm text-muted-foreground sm:col-span-2"><UserCog className="mb-2 h-5 w-5 text-[#5A92C9]" />Choose a user to assign portal roles.</div>}</div></CardContent></Card>
  </div>;
}
