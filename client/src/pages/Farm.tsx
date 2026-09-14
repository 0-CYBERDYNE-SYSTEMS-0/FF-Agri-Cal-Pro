import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { Farm, Field, Crop, Equipment, Building, StaffMember } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

// ---------- Local helpers ----------

const BADGE_CLASSES =
  "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium";

function StatusBadge({ label, colorClass }: { label: string; colorClass: string }) {
  return <span className={`${BADGE_CLASSES} ${colorClass}`}>{label}</span>;
}

const badgeColors: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  fallow: "bg-yellow-100 text-yellow-800",
  retired: "bg-neutral-100 text-neutral-600",
  planning: "bg-blue-100 text-blue-800",
  planted: "bg-green-100 text-green-800",
  growing: "bg-emerald-100 text-emerald-800",
  harvested: "bg-purple-100 text-purple-800",
  failed: "bg-red-100 text-red-800",
  operational: "bg-green-100 text-green-800",
  maintenance: "bg-yellow-100 text-yellow-800",
  down: "bg-red-100 text-red-800",
};

function EntityBadge({ value }: { value: string }) {
  const label = value.charAt(0).toUpperCase() + value.slice(1);
  return <StatusBadge label={label} colorClass={badgeColors[value] || "bg-neutral-100 text-neutral-600"} />;
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold text-neutral-900">{title}</CardTitle>
        <CardDescription className="text-sm text-neutral-500">{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function RowShell({
  title,
  meta,
  badge,
  onDelete,
  deleteLabel,
}: {
  title: string;
  meta?: string;
  badge?: React.ReactNode;
  onDelete: () => void;
  deleteLabel: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 border-b border-neutral-100 last:border-0">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-neutral-900">{title}</span>
          {badge}
        </div>
        {meta && <p className="text-sm text-neutral-500 truncate">{meta}</p>}
      </div>
      <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={onDelete}>
        {deleteLabel}
      </Button>
    </div>
  );
}

function useAddEntity(path: string, queryKey: string, label: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const response = await apiRequest("POST", path, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [queryKey] });
      toast({ title: `${label} added`, description: `Your ${label.toLowerCase()} has been added successfully.` });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `There was a problem adding the ${label.toLowerCase()}.`,
        variant: "destructive",
      });
      console.error(`Error adding ${label.toLowerCase()}:`, error);
    },
  });
}

function useDeleteEntity(path: string, queryKey: string, label: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `${path}/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [queryKey] });
      toast({ title: `${label} deleted`, description: `The ${label.toLowerCase()} has been deleted successfully.` });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `There was a problem deleting the ${label.toLowerCase()}.`,
        variant: "destructive",
      });
      console.error(`Error deleting ${label.toLowerCase()}:`, error);
    },
  });
}

function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="animate-pulse space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-10 bg-neutral-100 rounded" />
      ))}
    </div>
  );
}

function EmptyRow({ message }: { message: string }) {
  return <p className="py-4 text-center text-sm text-neutral-500">{message}</p>;
}

// ---------- Page ----------

export default function Farm() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Farm profile form state
  const [name, setName] = useState("");
  const [locationName, setLocationName] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [timeZone, setTimeZone] = useState("");
  const [growingZone, setGrowingZone] = useState("");
  const [totalAcres, setTotalAcres] = useState("");
  const [notes, setNotes] = useState("");

  const { data: farmData, isLoading: isLoadingFarm } = useQuery<{ farm: Farm | null }>({
    queryKey: ["/api/farm"],
    enabled: !!user,
  });
  const farm = farmData?.farm ?? null;

  useEffect(() => {
    if (farm) {
      setName(farm.name || "");
      setLocationName(farm.locationName ?? "");
      setLatitude(farm.latitude != null ? String(farm.latitude) : "");
      setLongitude(farm.longitude != null ? String(farm.longitude) : "");
      setTimeZone(farm.timeZone ?? "");
      setGrowingZone(farm.growingZone ?? "");
      setTotalAcres(farm.totalAcres != null ? String(farm.totalAcres) : "");
      setNotes(farm.notes ?? "");
    }
  }, [farm]);

  const saveFarmMutation = useMutation({
    mutationFn: async (farmData: Record<string, unknown>) => {
      const response = await apiRequest("PUT", "/api/farm", farmData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/farm"] });
      toast({
        title: "Farm profile saved",
        description: "Your farm profile has been saved successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "There was a problem saving your farm profile.",
        variant: "destructive",
      });
      console.error("Error saving farm profile:", error);
    },
  });

  const handleFarmSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast({
        title: "Missing Information",
        description: "Please provide a name for your farm.",
        variant: "destructive",
      });
      return;
    }

    const parsedLatitude = latitude.trim() === "" ? null : parseFloat(latitude);
    const parsedLongitude = longitude.trim() === "" ? null : parseFloat(longitude);
    const parsedAcres = totalAcres.trim() === "" ? null : parseFloat(totalAcres);

    if (parsedLatitude !== null && (isNaN(parsedLatitude) || parsedLatitude < -90 || parsedLatitude > 90)) {
      toast({
        title: "Invalid Latitude",
        description: "Latitude must be a number between -90 and 90.",
        variant: "destructive",
      });
      return;
    }
    if (parsedLongitude !== null && (isNaN(parsedLongitude) || parsedLongitude < -180 || parsedLongitude > 180)) {
      toast({
        title: "Invalid Longitude",
        description: "Longitude must be a number between -180 and 180.",
        variant: "destructive",
      });
      return;
    }
    if (parsedAcres !== null && (isNaN(parsedAcres) || parsedAcres < 0)) {
      toast({
        title: "Invalid Acreage",
        description: "Total acres must be a positive number.",
        variant: "destructive",
      });
      return;
    }

    saveFarmMutation.mutate({
      name: name.trim(),
      locationName: locationName.trim() || null,
      latitude: parsedLatitude,
      longitude: parsedLongitude,
      timeZone: timeZone.trim() || null,
      growingZone: growingZone.trim() || null,
      totalAcres: parsedAcres,
      notes: notes.trim() || null,
    });
  };

  // Field add form state
  const [fieldName, setFieldName] = useState("");
  const [fieldAcres, setFieldAcres] = useState("");
  const [fieldStatus, setFieldStatus] = useState("active");

  // Crop add form state
  const [cropName, setCropName] = useState("");
  const [cropFieldId, setCropFieldId] = useState("none");
  const [cropStatus, setCropStatus] = useState("planning");

  // Equipment add form state
  const [equipmentName, setEquipmentName] = useState("");
  const [equipmentCategory, setEquipmentCategory] = useState("tractor");
  const [equipmentStatus, setEquipmentStatus] = useState("operational");

  // Building add form state
  const [buildingName, setBuildingName] = useState("");
  const [buildingCategory, setBuildingCategory] = useState("barn");

  // Staff add form state
  const [staffName, setStaffName] = useState("");
  const [staffRole, setStaffRole] = useState("");
  const [staffContact, setStaffContact] = useState("");

  const { data: fields = [], isLoading: isLoadingFields } = useQuery<Field[]>({
    queryKey: ["/api/fields"],
    enabled: !!user,
  });
  const { data: crops = [], isLoading: isLoadingCrops } = useQuery<Crop[]>({
    queryKey: ["/api/crops"],
    enabled: !!user,
  });
  const { data: equipment = [], isLoading: isLoadingEquipment } = useQuery<Equipment[]>({
    queryKey: ["/api/equipment"],
    enabled: !!user,
  });
  const { data: buildings = [], isLoading: isLoadingBuildings } = useQuery<Building[]>({
    queryKey: ["/api/buildings"],
    enabled: !!user,
  });
  const { data: staff = [], isLoading: isLoadingStaff } = useQuery<StaffMember[]>({
    queryKey: ["/api/staff"],
    enabled: !!user,
  });

  const addFieldMutation = useAddEntity("/api/fields", "/api/fields", "Field");
  const deleteFieldMutation = useDeleteEntity("/api/fields", "/api/fields", "Field");
  const addCropMutation = useAddEntity("/api/crops", "/api/crops", "Crop");
  const deleteCropMutation = useDeleteEntity("/api/crops", "/api/crops", "Crop");
  const addEquipmentMutation = useAddEntity("/api/equipment", "/api/equipment", "Equipment");
  const deleteEquipmentMutation = useDeleteEntity("/api/equipment", "/api/equipment", "Equipment");
  const addBuildingMutation = useAddEntity("/api/buildings", "/api/buildings", "Building");
  const deleteBuildingMutation = useDeleteEntity("/api/buildings", "/api/buildings", "Building");
  const addStaffMutation = useAddEntity("/api/staff", "/api/staff", "Staff member");
  const deleteStaffMutation = useDeleteEntity("/api/staff", "/api/staff", "Staff member");

  const fieldById = (id: number | null) => (id == null ? null : fields.find((f) => f.id === id) ?? null);

  const handleAddField = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fieldName.trim()) {
      toast({ title: "Missing Information", description: "Please provide a name for the field.", variant: "destructive" });
      return;
    }
    const parsedAcres = fieldAcres.trim() === "" ? null : parseFloat(fieldAcres);
    if (parsedAcres !== null && (isNaN(parsedAcres) || parsedAcres < 0)) {
      toast({ title: "Invalid Acreage", description: "Acres must be a positive number.", variant: "destructive" });
      return;
    }
    addFieldMutation.mutate(
      { name: fieldName.trim(), acres: parsedAcres, status: fieldStatus },
      {
        onSuccess: () => {
          setFieldName("");
          setFieldAcres("");
          setFieldStatus("active");
        },
      }
    );
  };

  const handleAddCrop = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cropName.trim()) {
      toast({ title: "Missing Information", description: "Please provide a name for the crop.", variant: "destructive" });
      return;
    }
    addCropMutation.mutate(
      {
        name: cropName.trim(),
        fieldId: cropFieldId === "none" ? null : Number(cropFieldId),
        status: cropStatus,
      },
      {
        onSuccess: () => {
          setCropName("");
          setCropFieldId("none");
          setCropStatus("planning");
        },
      }
    );
  };

  const handleAddEquipment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!equipmentName.trim()) {
      toast({ title: "Missing Information", description: "Please provide a name for the equipment.", variant: "destructive" });
      return;
    }
    addEquipmentMutation.mutate(
      { name: equipmentName.trim(), category: equipmentCategory, status: equipmentStatus },
      {
        onSuccess: () => {
          setEquipmentName("");
          setEquipmentCategory("tractor");
          setEquipmentStatus("operational");
        },
      }
    );
  };

  const handleAddBuilding = (e: React.FormEvent) => {
    e.preventDefault();
    if (!buildingName.trim()) {
      toast({ title: "Missing Information", description: "Please provide a name for the building.", variant: "destructive" });
      return;
    }
    addBuildingMutation.mutate(
      { name: buildingName.trim(), category: buildingCategory },
      {
        onSuccess: () => {
          setBuildingName("");
          setBuildingCategory("barn");
        },
      }
    );
  };

  const handleAddStaff = (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffName.trim()) {
      toast({ title: "Missing Information", description: "Please provide a name for the staff member.", variant: "destructive" });
      return;
    }
    addStaffMutation.mutate(
      {
        name: staffName.trim(),
        role: staffRole.trim() || null,
        contact: staffContact.trim() || null,
      },
      {
        onSuccess: () => {
          setStaffName("");
          setStaffRole("");
          setStaffContact("");
        },
      }
    );
  };

  const addFormGrid = "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end";
  const smallLabel = "text-xs font-medium text-neutral-500";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-serif font-bold text-neutral-900">Farm Profile</h1>
        <p className="text-neutral-500 mt-1">
          Ground every plan and answer in your farm's details — fields, crops, equipment, buildings, and people.
        </p>
      </div>

      {/* Section 1: Farm profile */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold text-neutral-900">Farm Details</CardTitle>
          <CardDescription className="text-sm text-neutral-500">
            Setting your location and time zone powers weather-aware planning — forecasts, frost alerts, and planting windows tuned to your farm.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingFarm ? (
            <div className="animate-pulse space-y-4">
              <div className="h-10 bg-neutral-200 rounded" />
              <div className="h-10 bg-neutral-200 rounded w-2/3" />
              <div className="h-10 bg-neutral-200 rounded w-1/2" />
            </div>
          ) : (
            <>
              {!farm && (
                <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-md text-blue-800 text-sm">
                  Nothing here yet — tell the app about your farm and every plan and answer gets grounded in it.
                </div>
              )}
              <form onSubmit={handleFarmSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="farm-name">Farm Name</Label>
                    <Input
                      id="farm-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="mt-1"
                      placeholder="e.g. Willow Creek Farm"
                    />
                  </div>
                  <div>
                    <Label htmlFor="farm-location">Location Name</Label>
                    <Input
                      id="farm-location"
                      value={locationName}
                      onChange={(e) => setLocationName(e.target.value)}
                      className="mt-1"
                      placeholder="e.g. Corvallis, OR"
                    />
                  </div>
                  <div>
                    <Label htmlFor="farm-latitude">Latitude</Label>
                    <Input
                      id="farm-latitude"
                      type="number"
                      step="any"
                      min="-90"
                      max="90"
                      value={latitude}
                      onChange={(e) => setLatitude(e.target.value)}
                      className="mt-1"
                      placeholder="-90 to 90"
                    />
                  </div>
                  <div>
                    <Label htmlFor="farm-longitude">Longitude</Label>
                    <Input
                      id="farm-longitude"
                      type="number"
                      step="any"
                      min="-180"
                      max="180"
                      value={longitude}
                      onChange={(e) => setLongitude(e.target.value)}
                      className="mt-1"
                      placeholder="-180 to 180"
                    />
                  </div>
                  <div>
                    <Label htmlFor="farm-timezone">Time Zone</Label>
                    <Input
                      id="farm-timezone"
                      value={timeZone}
                      onChange={(e) => setTimeZone(e.target.value)}
                      className="mt-1"
                      placeholder="e.g. America/Los_Angeles"
                    />
                  </div>
                  <div>
                    <Label htmlFor="farm-growing-zone">Growing Zone</Label>
                    <Input
                      id="farm-growing-zone"
                      value={growingZone}
                      onChange={(e) => setGrowingZone(e.target.value)}
                      className="mt-1"
                      placeholder="e.g. Zone 8b"
                    />
                  </div>
                  <div>
                    <Label htmlFor="farm-acres">Total Acres</Label>
                    <Input
                      id="farm-acres"
                      type="number"
                      step="any"
                      min="0"
                      value={totalAcres}
                      onChange={(e) => setTotalAcres(e.target.value)}
                      className="mt-1"
                      placeholder="e.g. 120"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="farm-notes">Notes</Label>
                  <Textarea
                    id="farm-notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="mt-1"
                    rows={3}
                    placeholder="Anything else the assistant should know about your farm..."
                  />
                </div>
                <div className="flex justify-end">
                  <Button
                    type="submit"
                    className="bg-primary hover:bg-primary-dark"
                    disabled={saveFarmMutation.isPending}
                  >
                    {saveFarmMutation.isPending ? "Saving..." : "Save Farm Profile"}
                  </Button>
                </div>
              </form>
            </>
          )}
        </CardContent>
      </Card>

      {/* Section 2: Fields */}
      <SectionCard title="Fields" description="Your growing areas — track acreage, soil, and what's planted.">
        {isLoadingFields ? (
          <ListSkeleton />
        ) : (
          <div className="mb-2">
            {fields.length > 0 ? (
              fields.map((field) => (
                <RowShell
                  key={field.id}
                  title={field.name}
                  badge={<EntityBadge value={field.status} />}
                  meta={[
                    field.acres != null ? `${field.acres} acres` : null,
                    field.soilType,
                    field.currentCrop ? `Growing: ${field.currentCrop}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || undefined}
                  deleteLabel="Delete"
                  onDelete={() => {
                    if (window.confirm(`Delete field "${field.name}"?`)) {
                      deleteFieldMutation.mutate(field.id);
                    }
                  }}
                />
              ))
            ) : (
              <EmptyRow message="No fields yet. Add your first field to start tracking plantings." />
            )}
          </div>
        )}
        <form onSubmit={handleAddField} className={addFormGrid}>
          <div>
            <Label htmlFor="field-name" className={smallLabel}>Name</Label>
            <Input
              id="field-name"
              value={fieldName}
              onChange={(e) => setFieldName(e.target.value)}
              className="mt-1"
              placeholder="e.g. North Pasture"
            />
          </div>
          <div>
            <Label htmlFor="field-acres" className={smallLabel}>Acres</Label>
            <Input
              id="field-acres"
              type="number"
              step="any"
              min="0"
              value={fieldAcres}
              onChange={(e) => setFieldAcres(e.target.value)}
              className="mt-1"
              placeholder="e.g. 12"
            />
          </div>
          <div>
            <Label htmlFor="field-status" className={smallLabel}>Status</Label>
            <Select value={fieldStatus} onValueChange={setFieldStatus}>
              <SelectTrigger className="w-full mt-1" id="field-status">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="fallow">Fallow</SelectItem>
                <SelectItem value="retired">Retired</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" variant="outline" disabled={addFieldMutation.isPending}>
            {addFieldMutation.isPending ? "Adding..." : "Add Field"}
          </Button>
        </form>
      </SectionCard>

      {/* Section 3: Crops */}
      <SectionCard title="Crops" description="What's planted or planned, and where it's growing.">
        {isLoadingCrops ? (
          <ListSkeleton />
        ) : (
          <div className="mb-2">
            {crops.length > 0 ? (
              crops.map((crop) => {
                const field = fieldById(crop.fieldId);
                return (
                  <RowShell
                    key={crop.id}
                    title={crop.name}
                    badge={<EntityBadge value={crop.status} />}
                    meta={[
                      crop.variety,
                      field ? `Field: ${field.name}` : null,
                      crop.expectedHarvestAt
                        ? `Harvest: ${new Date(crop.expectedHarvestAt).toLocaleDateString()}`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || undefined}
                    deleteLabel="Delete"
                    onDelete={() => {
                      if (window.confirm(`Delete crop "${crop.name}"?`)) {
                        deleteCropMutation.mutate(crop.id);
                      }
                    }}
                  />
                );
              })
            ) : (
              <EmptyRow message="No crops yet. Add a crop to track plantings and harvests." />
            )}
          </div>
        )}
        <form onSubmit={handleAddCrop} className={addFormGrid}>
          <div>
            <Label htmlFor="crop-name" className={smallLabel}>Name</Label>
            <Input
              id="crop-name"
              value={cropName}
              onChange={(e) => setCropName(e.target.value)}
              className="mt-1"
              placeholder="e.g. Sweet Corn"
            />
          </div>
          <div>
            <Label htmlFor="crop-field" className={smallLabel}>Field</Label>
            <Select value={cropFieldId} onValueChange={setCropFieldId}>
              <SelectTrigger className="w-full mt-1" id="crop-field">
                <SelectValue placeholder="Select field" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No field</SelectItem>
                {fields.map((field) => (
                  <SelectItem key={field.id} value={String(field.id)}>
                    {field.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="crop-status" className={smallLabel}>Status</Label>
            <Select value={cropStatus} onValueChange={setCropStatus}>
              <SelectTrigger className="w-full mt-1" id="crop-status">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="planning">Planning</SelectItem>
                <SelectItem value="planted">Planted</SelectItem>
                <SelectItem value="growing">Growing</SelectItem>
                <SelectItem value="harvested">Harvested</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" variant="outline" disabled={addCropMutation.isPending}>
            {addCropMutation.isPending ? "Adding..." : "Add Crop"}
          </Button>
        </form>
      </SectionCard>

      {/* Section 4: Equipment */}
      <SectionCard title="Equipment" description="Machinery and tools in your inventory.">
        {isLoadingEquipment ? (
          <ListSkeleton />
        ) : (
          <div className="mb-2">
            {equipment.length > 0 ? (
              equipment.map((item) => (
                <RowShell
                  key={item.id}
                  title={item.name}
                  badge={<EntityBadge value={item.status} />}
                  meta={item.category ? item.category.charAt(0).toUpperCase() + item.category.slice(1) : undefined}
                  deleteLabel="Delete"
                  onDelete={() => {
                    if (window.confirm(`Delete equipment "${item.name}"?`)) {
                      deleteEquipmentMutation.mutate(item.id);
                    }
                  }}
                />
              ))
            ) : (
              <EmptyRow message="No equipment yet. Add a tractor, implement, or tool to keep tabs on it." />
            )}
          </div>
        )}
        <form onSubmit={handleAddEquipment} className={addFormGrid}>
          <div>
            <Label htmlFor="equipment-name" className={smallLabel}>Name</Label>
            <Input
              id="equipment-name"
              value={equipmentName}
              onChange={(e) => setEquipmentName(e.target.value)}
              className="mt-1"
              placeholder="e.g. John Deere 5075E"
            />
          </div>
          <div>
            <Label htmlFor="equipment-category" className={smallLabel}>Category</Label>
            <Select value={equipmentCategory} onValueChange={setEquipmentCategory}>
              <SelectTrigger className="w-full mt-1" id="equipment-category">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tractor">Tractor</SelectItem>
                <SelectItem value="implement">Implement</SelectItem>
                <SelectItem value="vehicle">Vehicle</SelectItem>
                <SelectItem value="irrigation">Irrigation</SelectItem>
                <SelectItem value="tool">Tool</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="equipment-status" className={smallLabel}>Status</Label>
            <Select value={equipmentStatus} onValueChange={setEquipmentStatus}>
              <SelectTrigger className="w-full mt-1" id="equipment-status">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="operational">Operational</SelectItem>
                <SelectItem value="maintenance">Maintenance</SelectItem>
                <SelectItem value="down">Down</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" variant="outline" disabled={addEquipmentMutation.isPending}>
            {addEquipmentMutation.isPending ? "Adding..." : "Add Equipment"}
          </Button>
        </form>
      </SectionCard>

      {/* Section 5: Buildings */}
      <SectionCard title="Buildings" description="Barns, greenhouses, silos, and other infrastructure.">
        {isLoadingBuildings ? (
          <ListSkeleton />
        ) : (
          <div className="mb-2">
            {buildings.length > 0 ? (
              buildings.map((building) => (
                <RowShell
                  key={building.id}
                  title={building.name}
                  badge={
                    building.category ? (
                      <StatusBadge
                        label={building.category.charAt(0).toUpperCase() + building.category.slice(1)}
                        colorClass="bg-neutral-100 text-neutral-600"
                      />
                    ) : undefined
                  }
                  meta={building.notes || undefined}
                  deleteLabel="Delete"
                  onDelete={() => {
                    if (window.confirm(`Delete building "${building.name}"?`)) {
                      deleteBuildingMutation.mutate(building.id);
                    }
                  }}
                />
              ))
            ) : (
              <EmptyRow message="No buildings yet. Add a barn, greenhouse, or shed to map your farm." />
            )}
          </div>
        )}
        <form onSubmit={handleAddBuilding} className={`${addFormGrid} lg:grid-cols-3`}>
          <div>
            <Label htmlFor="building-name" className={smallLabel}>Name</Label>
            <Input
              id="building-name"
              value={buildingName}
              onChange={(e) => setBuildingName(e.target.value)}
              className="mt-1"
              placeholder="e.g. Red Barn"
            />
          </div>
          <div>
            <Label htmlFor="building-category" className={smallLabel}>Category</Label>
            <Select value={buildingCategory} onValueChange={setBuildingCategory}>
              <SelectTrigger className="w-full mt-1" id="building-category">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="barn">Barn</SelectItem>
                <SelectItem value="greenhouse">Greenhouse</SelectItem>
                <SelectItem value="silo">Silo</SelectItem>
                <SelectItem value="shed">Shed</SelectItem>
                <SelectItem value="coop">Coop</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" variant="outline" disabled={addBuildingMutation.isPending}>
            {addBuildingMutation.isPending ? "Adding..." : "Add Building"}
          </Button>
        </form>
      </SectionCard>

      {/* Section 6: Staff */}
      <SectionCard title="Staff" description="People who work on the farm and how to reach them.">
        {isLoadingStaff ? (
          <ListSkeleton />
        ) : (
          <div className="mb-2">
            {staff.length > 0 ? (
              staff.map((member) => (
                <RowShell
                  key={member.id}
                  title={member.name}
                  meta={[member.role, member.contact].filter(Boolean).join(" · ") || undefined}
                  deleteLabel="Delete"
                  onDelete={() => {
                    if (window.confirm(`Delete staff member "${member.name}"?`)) {
                      deleteStaffMutation.mutate(member.id);
                    }
                  }}
                />
              ))
            ) : (
              <EmptyRow message="No staff yet. Add workers or contacts for your farm team." />
            )}
          </div>
        )}
        <form onSubmit={handleAddStaff} className={addFormGrid}>
          <div>
            <Label htmlFor="staff-name" className={smallLabel}>Name</Label>
            <Input
              id="staff-name"
              value={staffName}
              onChange={(e) => setStaffName(e.target.value)}
              className="mt-1"
              placeholder="e.g. Maria Lopez"
            />
          </div>
          <div>
            <Label htmlFor="staff-role" className={smallLabel}>Role</Label>
            <Input
              id="staff-role"
              value={staffRole}
              onChange={(e) => setStaffRole(e.target.value)}
              className="mt-1"
              placeholder="e.g. Field Manager"
            />
          </div>
          <div>
            <Label htmlFor="staff-contact" className={smallLabel}>Contact</Label>
            <Input
              id="staff-contact"
              value={staffContact}
              onChange={(e) => setStaffContact(e.target.value)}
              className="mt-1"
              placeholder="e.g. (541) 555-0199"
            />
          </div>
          <Button type="submit" variant="outline" disabled={addStaffMutation.isPending}>
            {addStaffMutation.isPending ? "Adding..." : "Add Staff"}
          </Button>
        </form>
      </SectionCard>
    </div>
  );
}
