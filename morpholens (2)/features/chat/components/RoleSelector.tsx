
import React, { useRef, useState, useEffect } from "react";
import { ChevronDown, Check, Upload, Boxes, PlusCircle, Download } from "lucide-react";
import { cn } from "../../../lib/utils";
import { roleRegistry } from "../../../services/roles/registry";
import { roleLoader } from "../../../services/roles/loader";
import { Button } from "../../../components/ui/Button";
import { RoleBuilderModal } from "./RoleBuilderModal";
import { exportRole } from "../../../services/roles/export";

interface RoleSelectorProps {
  activeRoleId: string;
  onRoleChange: (roleId: string) => void;
}

export function RoleSelector({ activeRoleId, onRoleChange }: RoleSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [roles, setRoles] = useState(roleRegistry.getAllRoles());
  const activeRole = roles.find(r => r.manifest.id === activeRoleId) || roles[0];
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
     setRoles(roleRegistry.getAllRoles());
  }, [isOpen]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
        const role = await roleLoader.loadFromFile(file);
        await roleRegistry.registerRole(role, file);
        setRoles(roleRegistry.getAllRoles());
        onRoleChange(role.manifest.id);
        setIsOpen(false);
    } catch (err) {
        console.error("Failed to load role", err);
        alert("Failed to load role file. Check console for details.");
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="relative">
        <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setIsOpen(!isOpen)}
            className="h-8 gap-2 px-2 text-xs font-medium rounded-lg border bg-white border-zinc-200 hover:bg-zinc-50 shadow-sm text-zinc-700"
        >
            <Boxes size={14} className="text-zinc-500" />
            <span className="truncate max-w-[100px]">{activeRole?.manifest.name || "Select Role"}</span>
            <ChevronDown size={12} className="opacity-50" />
        </Button>

        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <div className="absolute bottom-full left-0 mb-2 w-64 bg-white rounded-lg shadow-xl border border-zinc-200 z-50 overflow-hidden animate-in zoom-in-95 fade-in duration-200">
                <div className="px-2 py-1.5 border-b border-zinc-100 bg-zinc-50/50">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Active Role</span>
                </div>
                
                <div className="max-h-[300px] overflow-y-auto p-1">
                    {roles.map(role => (
                        <div 
                            key={role.manifest.id}
                            onClick={() => { onRoleChange(role.manifest.id); setIsOpen(false); }}
                            className={cn(
                                "group flex items-start gap-3 px-3 py-2.5 cursor-pointer rounded-md transition-colors",
                                activeRoleId === role.manifest.id 
                                    ? "bg-indigo-50 border border-indigo-100" 
                                    : "hover:bg-zinc-50 border border-transparent"
                            )}
                        >
                            <div className={cn(
                                "mt-0.5 w-2 h-2 rounded-full flex-shrink-0",
                                activeRoleId === role.manifest.id ? "bg-indigo-500" : "bg-zinc-300"
                            )} />
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                    <span className={cn("text-xs font-semibold truncate", activeRoleId === role.manifest.id ? "text-indigo-900" : "text-zinc-900")}>
                                        {role.manifest.name}
                                    </span>
                                    <div className="flex items-center gap-1">
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            exportRole(role);
                                          }}
                                          className="p-1 hover:bg-zinc-200 rounded opacity-0 group-hover:opacity-100 transition-opacity text-zinc-500"
                                          title="Export role"
                                        >
                                          <Download size={12} />
                                        </button>
                                        {activeRoleId === role.manifest.id && <Check size={12} className="text-indigo-600" />}
                                    </div>
                                </div>
                                <p className="text-[10px] text-zinc-500 line-clamp-2 mt-0.5 leading-snug">
                                    {role.manifest.description}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="border-t border-zinc-100 p-1">
                    <div
                        onClick={() => { setBuilderOpen(true); setIsOpen(false); }}
                        className="flex items-center gap-2 px-3 py-2 hover:bg-zinc-50 rounded-md cursor-pointer text-xs font-medium text-zinc-600 transition-colors"
                    >
                        <PlusCircle size={14} />
                        Create New Role...
                    </div>
                    <div 
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-2 px-3 py-2 hover:bg-zinc-50 rounded-md cursor-pointer text-xs font-medium text-zinc-600 transition-colors"
                    >
                        <Upload size={14} />
                        Upload .role file...
                    </div>
                    <input 
                        ref={fileInputRef}
                        type="file" 
                        accept=".role,.zip" 
                        className="hidden" 
                        onChange={handleUpload} 
                    />
                </div>
            </div>
          </>
        )}

        <RoleBuilderModal
            isOpen={builderOpen}
            onClose={() => setBuilderOpen(false)}
            onRoleCreated={(id) => {
                setRoles(roleRegistry.getAllRoles());
                onRoleChange(id);
            }}
        />
    </div>
  );
}
