# Templates — Archivos del CRUD

Plantillas completas para cada archivo del módulo. Reemplazar los placeholders según la entidad.

---

## 1. `src/types/{entidad}.ts`

```typescript
export interface {Entidad} {
    id: number;
    uuid: string;
    nombre: string;
    // ← agregar campos propios de la entidad
    esActivo: boolean;
}

export interface {Entidad}ContextType {
    searchTerm: string;
    setSearchTerm: (term: string) => void;
}
```

**Después de crear este archivo**, agregar en `src/types/index.ts`:
```typescript
export * from './{entidad}';
```

---

## 2. `src/services/{entidad}Service.ts`

```typescript
import { {Entidad} } from '../types';
import { httpClient } from './httpClient';

export interface {Entidad}Response {
    success: boolean;
    data?: {Entidad}[];
    {entidad}?: {Entidad};
    message?: string;
}

export const {entidad}Service = {
    get{Entidades}: async (query?: string): Promise<{Entidad}Response> => {
        try {
            const response: any = await httpClient.get('/{entidades}');
            let items: {Entidad}[] = Array.isArray(response) ? response : (response.data || []);

            if (query) {
                const q = query.toLowerCase();
                items = items.filter(u =>
                    u.nombre?.toLowerCase().includes(q)
                    // ← agregar más campos de búsqueda
                );
            }

            return {
                success: true,
                data: items,
                message: response.mensaje || '{Entidades} obtenidos correctamente'
            };
        } catch (error: any) {
            console.error('Error al obtener {entidades}:', error);
            return { success: false, message: error.message || 'Error al conectar con el servicio de {entidades}' };
        }
    },

    create{Entidad}: async (data: Omit<{Entidad}, 'id' | 'uuid'>): Promise<{Entidad}Response> => {
        try {
            const response: any = await httpClient.post('/{entidades}', data);
            return { success: true, {entidad}: response.data, message: response.mensaje || '{Entidad} creado exitosamente' };
        } catch (error: any) {
            return { success: false, message: error.message || 'Error al crear {entidad}' };
        }
    },

    update{Entidad}: async (uuid: string, data: Partial<{Entidad}>): Promise<{Entidad}Response> => {
        try {
            const response: any = await httpClient.put(`/{entidades}/${uuid}`, data);
            return { success: true, {entidad}: response.data, message: response.mensaje || '{Entidad} actualizado exitosamente' };
        } catch (error: any) {
            return { success: false, message: error.message || 'Error al actualizar {entidad}' };
        }
    },

    get{Entidad}ByUuid: async (uuid: string): Promise<{Entidad}Response> => {
        try {
            const response: any = await httpClient.get(`/{entidades}/${uuid}`);
            return { success: true, {entidad}: response.data, message: response.mensaje || 'Detalle de {entidad} obtenido' };
        } catch (error: any) {
            console.error(`Error al obtener {entidad} ${uuid}:`, error);
            return { success: false, message: error.message || 'Error al obtener el detalle del {entidad}' };
        }
    },

    delete{Entidad}: async (uuid: string): Promise<{Entidad}Response> => {
        try {
            const response: any = await httpClient.delete(`/{entidades}/${uuid}`);
            return { success: true, message: response.mensaje || '{Entidad} eliminado exitosamente' };
        } catch (error: any) {
            return { success: false, message: error.message || 'Error al eliminar {entidad}' };
        }
    }
};
```

---

## 3. `src/context/{Entidad}Context.tsx`

```typescript
import React, { createContext, useContext, useState, ReactNode } from 'react';
import { {Entidad}ContextType } from '../types';

const {Entidad}Context = createContext<{Entidad}ContextType | undefined>(undefined);

export const {Entidad}Provider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [searchTerm, setSearchTerm] = useState('');

    return (
        <{Entidad}Context.Provider value={{ searchTerm, setSearchTerm }}>
            {children}
        </{Entidad}Context.Provider>
    );
};

export const use{Entidades} = () => {
    const context = useContext({Entidad}Context);
    if (context === undefined) {
        throw new Error('use{Entidades} must be used within a {Entidad}Provider');
    }
    return context;
};
```

---

## 4. `src/utils/validators.ts` — Agregar validador

```typescript
// Agregar junto a los otros validators existentes:
import { {Entidad} } from '../types';

export const {entidad}Validator = {
    validate: (data: Partial<{Entidad}>): { isValid: boolean; errors: Record<string, string> } => {
        const errors: Record<string, string> = {};

        if (!data.nombre || data.nombre.trim().length < 2) {
            errors.nombre = 'El nombre debe tener al menos 2 caracteres';
        }
        // ← agregar más validaciones según los campos de la entidad

        return { isValid: Object.keys(errors).length === 0, errors };
    }
};
```

---

## 5. `src/hooks/{entidades}/use{Entidad}Queries.ts`

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { {entidad}Service } from '../../services/{entidad}Service';
import { {Entidad} } from '../../types';

export const {entidad}Keys = {
    all: ['{entidades}'] as const,
    lists: () => [...{entidad}Keys.all, 'list'] as const,
    list: (filters: string) => [...{entidad}Keys.lists(), { filters }] as const,
    details: () => [...{entidad}Keys.all, 'detail'] as const,
    detail: (uuid: string) => [...{entidad}Keys.details(), uuid] as const,
};

export const use{Entidades}Query = () =>
    useQuery({
        queryKey: {entidad}Keys.lists(),
        queryFn: () => {entidad}Service.get{Entidades}(''),
        staleTime: 1000 * 60 * 5,
    });

export const use{Entidad}DetailQuery = (uuid: string | undefined) =>
    useQuery({
        queryKey: {entidad}Keys.detail(uuid || ''),
        queryFn: () => {entidad}Service.get{Entidad}ByUuid(uuid!),
        enabled: !!uuid,
    });

export const useCreate{Entidad}Mutation = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (new{Entidad}: Omit<{Entidad}, 'id' | 'uuid'>) =>
            {entidad}Service.create{Entidad}(new{Entidad}),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: {entidad}Keys.lists() }),
    });
};

export const useUpdate{Entidad}Mutation = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ uuid, data }: { uuid: string; data: Partial<{Entidad}> }) =>
            {entidad}Service.update{Entidad}(uuid, data),
        onSuccess: (_, { uuid }) => {
            queryClient.invalidateQueries({ queryKey: {entidad}Keys.lists() });
            queryClient.invalidateQueries({ queryKey: {entidad}Keys.detail(uuid) });
        },
    });
};

export const useDelete{Entidad}Mutation = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (uuid: string) => {entidad}Service.delete{Entidad}(uuid),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: {entidad}Keys.lists() }),
    });
};
```

---

## 6. `src/hooks/{entidades}/use{Entidades}Board.ts`

```typescript
import { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Alert } from '../../utils/alerts';
import {
    use{Entidades}Query,
    useCreate{Entidad}Mutation,
    useUpdate{Entidad}Mutation,
    useDelete{Entidad}Mutation,
    {entidad}Keys
} from './use{Entidad}Queries';
import { use{Entidades} } from '../../context/{Entidad}Context';
import { {entidad}Service } from '../../services/{entidad}Service';
import { {Entidad} } from '../../types';
import { {entidad}Validator } from '../../utils/validators';

export const use{Entidades}Board = () => {
    const queryClient = useQueryClient();
    const { searchTerm, setSearchTerm } = use{Entidades}();

    const { data: {entidades}Response, isLoading: isListLoading } = use{Entidades}Query();
    const createMutation = useCreate{Entidad}Mutation();
    const updateMutation = useUpdate{Entidad}Mutation();
    const deleteMutation = useDelete{Entidad}Mutation();

    const all{Entidades} = {entidades}Response?.data || [];
    const filtered{Entidades} = useMemo(() => {
        if (!searchTerm.trim()) return all{Entidades};
        const term = searchTerm.toLowerCase();
        return all{Entidades}.filter(u =>
            u.nombre?.toLowerCase().includes(term)
            // ← agregar más campos filtrables
        );
    }, [all{Entidades}, searchTerm]);

    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [current{Entidad}, setCurrent{Entidad}] = useState<Partial<{Entidad}> | null>(null);
    const [selected{Entidad}, setSelected{Entidad}] = useState<{Entidad} | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});
    const [isFetchingDetail, setIsFetchingDetail] = useState(false);

    const handleOpenCreate = () => {
        setFormErrors({});
        setCurrent{Entidad}({ nombre: '', esActivo: true });
        setIsFormOpen(true);
    };

    const handleOpenEdit = async ({entidad}: {Entidad}) => {
        setFormErrors({});
        setIsFetchingDetail(true);
        try {
            const result = await queryClient.fetchQuery({
                queryKey: {entidad}Keys.detail({entidad}.uuid),
                queryFn: () => {entidad}Service.get{Entidad}ByUuid({entidad}.uuid)
            });
            if (result.success && result.{entidad}) {
                setCurrent{Entidad}(result.{entidad});
                setIsFormOpen(true);
            } else {
                Alert.error(result.message || 'No se pudo obtener la información actualizada', 'Por favor, intenta nuevamente');
            }
        } catch {
            Alert.error('Error al cargar la información', 'Ocurrió un problema de red o el servicio no respondió');
        } finally {
            setIsFetchingDetail(false);
        }
    };

    const handleOpenDetail = async ({entidad}: {Entidad}) => {
        setIsFetchingDetail(true);
        try {
            const result = await queryClient.fetchQuery({
                queryKey: {entidad}Keys.detail({entidad}.uuid),
                queryFn: () => {entidad}Service.get{Entidad}ByUuid({entidad}.uuid)
            });
            if (result.success && result.{entidad}) {
                setSelected{Entidad}(result.{entidad});
                setIsDetailOpen(true);
            } else {
                Alert.error(result.message || 'No se pudo obtener el detalle', 'Por favor, intenta nuevamente');
            }
        } catch {
            Alert.error('Error al cargar los detalles', 'Ocurrió un problema de red o el servicio no respondió');
        } finally {
            setIsFetchingDetail(false);
        }
    };

    const handleSubmit = async () => {
        if (!current{Entidad}) return;

        const validation = {entidad}Validator.validate(current{Entidad});
        if (!validation.isValid) {
            setFormErrors(validation.errors);
            return;
        }

        setIsSubmitting(true);
        try {
            const result = current{Entidad}.uuid
                ? await updateMutation.mutateAsync({ uuid: current{Entidad}.uuid, data: current{Entidad} })
                : await createMutation.mutateAsync(current{Entidad} as Omit<{Entidad}, 'id' | 'uuid'>);

            if (result.success) {
                Alert.success(result.message || '{Entidad} guardado correctamente');
                setIsFormOpen(false);
            } else {
                Alert.error('Error al guardar', result.message);
            }
        } catch {
            Alert.error('Error', 'Error al procesar la solicitud');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (uuid: string) => {
        const confirmed = await Alert.confirm('¿Confirmar eliminación?', 'Esta acción no se puede revertir.', 'Sí, eliminar');
        if (!confirmed) return;

        try {
            const result = await deleteMutation.mutateAsync(uuid);
            if (result.success) {
                Alert.success(result.message || '{Entidad} eliminado con éxito');
            } else {
                Alert.error('Error al eliminar', result.message);
            }
        } catch {
            Alert.error('Error', 'Error al eliminar debido a un fallo en el servidor');
        }
    };

    return {
        filtered{Entidades}, searchTerm, setSearchTerm, isListLoading,
        isFormOpen, setIsFormOpen, isDetailOpen, setIsDetailOpen,
        current{Entidad}, setCurrent{Entidad}, selected{Entidad},
        isSubmitting, formErrors, isFetchingDetail,
        handleOpenCreate, handleOpenEdit, handleOpenDetail, handleSubmit, handleDelete
    };
};
```

---

## 7. `src/pages/{entidades}/{Entidades}.tsx`

```typescript
import React from 'react';
import { {IconName}, Plus } from 'lucide-react';
import { Box } from '@mui/material';
import { use{Entidades}Board } from '../../hooks/{entidades}/use{Entidades}Board';
import Button from '../../components/ui/Button';
import Loader from '../../components/layout/Loader';
import PageHeader from '../../components/ui/PageHeader';
import {Entidad}List from './components/{Entidad}List';
import {Entidad}Form from './components/{Entidad}Form';
import {Entidad}Detail from './components/{Entidad}Detail';

const {Entidades}: React.FC = () => {
    const board = use{Entidades}Board();

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <PageHeader
                title="Gestión de {Entidades}"
                description="Administra los {entidades} del sistema."
                icon={{IconName}}
                actionButton={
                    <Button variant="primary" size="lg" onClick={board.handleOpenCreate} className="shadow-xl" icon={Plus}>
                        Nuevo {Entidad}
                    </Button>
                }
            />

            {board.isFetchingDetail && <Loader message="Obteniendo detalles..." />}

            <{Entidad}List
                {entidades}={board.filtered{Entidades}}
                isLoading={board.isListLoading}
                searchTerm={board.searchTerm}
                onSearchChange={board.setSearchTerm}
                onEdit={board.handleOpenEdit}
                onDelete={board.handleDelete}
                onDetail={board.handleOpenDetail}
            />

            <{Entidad}Form
                open={board.isFormOpen}
                onClose={() => board.setIsFormOpen(false)}
                {entidad}={board.current{Entidad}}
                on{Entidad}Change={board.setCurrent{Entidad}}
                onSubmit={board.handleSubmit}
                isSubmitting={board.isSubmitting}
                errors={board.formErrors}
            />

            <{Entidad}Detail
                open={board.isDetailOpen}
                onClose={() => board.setIsDetailOpen(false)}
                {entidad}={board.selected{Entidad}}
            />
        </Box>
    );
};

export default {Entidades};
```

---

## 8. `src/pages/{entidades}/components/{Entidad}List.tsx`

```typescript
import React from 'react';
import { Edit2, Trash2, Eye } from 'lucide-react';
import { GridActionsCellItem, GridColDef } from '@mui/x-data-grid';
import { Tooltip } from '@mui/material';
import DataTable from '../../../components/ui/DataTable';
import { {Entidad} } from '../../../types';

interface {Entidad}ListProps {
    {entidades}: {Entidad}[];
    isLoading: boolean;
    searchTerm: string;
    onSearchChange: (value: string) => void;
    onEdit: ({entidad}: {Entidad}) => void;
    onDelete: (uuid: string) => void;
    onDetail: ({entidad}: {Entidad}) => void;
}

const {Entidad}List: React.FC<{Entidad}ListProps> = ({
    {entidades}, isLoading, searchTerm, onSearchChange, onEdit, onDelete, onDetail
}) => {
    const columns: GridColDef[] = [
        { field: 'id', headerName: 'ID', width: 80, headerAlign: 'center', align: 'center' },
        { field: 'nombre', headerName: 'Nombre', flex: 1, minWidth: 200 },
        // ← agregar más columnas según la entidad
        {
            field: 'esActivo',
            headerName: 'Estado',
            width: 120,
            align: 'center',
            headerAlign: 'center',
            renderCell: (params) => (
                <span className={`px-3 py-1 rounded-lg text-xs font-bold uppercase ${
                    params.value ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'
                }`}>
                    {params.value ? 'Activo' : 'Inactivo'}
                </span>
            )
        },
        {
            field: 'acciones',
            type: 'actions',
            headerName: 'Acciones',
            width: 160,
            align: 'center',
            headerAlign: 'center',
            getActions: (params) => [
                <GridActionsCellItem
                    key="detail"
                    icon={<Tooltip title="Ver detalle" arrow placement="top"><span><Eye size={16} /></span></Tooltip>}
                    label="Ver detalle"
                    onClick={() => onDetail(params.row as {Entidad})}
                    className="text-gray-500 hover:text-blue-500"
                />,
                <GridActionsCellItem
                    key="edit"
                    icon={<Tooltip title="Editar" arrow placement="top"><span><Edit2 size={16} /></span></Tooltip>}
                    label="Editar"
                    onClick={() => onEdit(params.row as {Entidad})}
                    className="text-gray-500 hover:text-green-600"
                />,
                <GridActionsCellItem
                    key="delete"
                    icon={<Tooltip title="Eliminar" arrow placement="top"><span><Trash2 size={16} /></span></Tooltip>}
                    label="Eliminar"
                    onClick={() => onDelete(params.row.uuid)}
                    className="text-gray-500 hover:text-red-500"
                />
            ]
        }
    ];

    return (
        <DataTable
            title={`Lista de {entidades} (${{{entidades}.length})`}
            rows={{entidades}}
            columns={columns}
            isLoading={isLoading}
            searchTerm={searchTerm}
            onSearchChange={onSearchChange}
            searchPlaceholder="Buscar {entidad}..."
            getRowId={(row: {Entidad}) => row.id || row.uuid || Math.random()}
        />
    );
};

export default {Entidad}List;
```

---

## 9. `src/pages/{entidades}/components/{Entidad}Form.tsx`

```typescript
import React from 'react';
import { Edit2, Plus, X, Save, Activity } from 'lucide-react';
import { {Entidad} } from '../../../types';
import Button from '../../../components/ui/Button';
import FormModal from '../../../components/ui/FormModal';
import { FormField } from '../../../components/ui/FormField';
import FormSelect from '../../../components/ui/FormSelect';

interface {Entidad}FormProps {
    open: boolean;
    onClose: () => void;
    {entidad}: Partial<{Entidad}> | null;
    on{Entidad}Change: ({entidad}: Partial<{Entidad}>) => void;
    onSubmit: () => void;
    isSubmitting: boolean;
    errors: Record<string, string>;
}

const {Entidad}Form: React.FC<{Entidad}FormProps> = ({
    open, onClose, {entidad}, on{Entidad}Change, onSubmit, isSubmitting, errors
}) => {
    const isEditing = !!{entidad}?.id;

    return (
        <FormModal
            open={open}
            onClose={onClose}
            size="md"
            icon={isEditing ? <Edit2 size={22} /> : <Plus size={22} />}
            title={isEditing ? 'Editar {Entidad}' : 'Nuevo {Entidad}'}
            subtitle={isEditing ? 'Actualiza los datos del {entidad}.' : 'Registra un nuevo {entidad} en el sistema.'}
            footer={
                <>
                    <Button variant="ghost" onClick={onClose} className="px-6 font-bold" icon={X}>
                        Cancelar
                    </Button>
                    <Button
                        variant="primary"
                        onClick={onSubmit}
                        loading={isSubmitting}
                        icon={Save}
                        className="px-12 shadow-lg shadow-primary/30 font-black tracking-wide"
                    >
                        {isEditing ? 'Actualizar' : 'Crear'}
                    </Button>
                </>
            }
        >
            <div className="flex flex-col gap-5">
                <p className="text-xs font-black uppercase tracking-widest text-primary">
                    Datos del {Entidad}
                </p>
                <div className="grid grid-cols-1 gap-4">
                    <FormField
                        label="Nombre"
                        placeholder="Ej. Nombre del {entidad}"
                        value={{entidad}?.nombre || ''}
                        onChange={(e) => on{Entidad}Change({ ...{entidad}, nombre: e.target.value })}
                        error={!!!({entidad}?.nombre) && !!errors.nombre}
                        helperText={errors.nombre}
                    />
                    {/* ← agregar más FormField/FormSelect según la entidad */}
                    <FormSelect
                        label="Estado"
                        icon={<Activity size={18} />}
                        value={{entidad}?.esActivo ?? true}
                        onChange={(val: string) => on{Entidad}Change({ ...{entidad}, esActivo: val === 'true' })}
                        options={[
                            { label: 'Activo', value: 'true' },
                            { label: 'Inactivo', value: 'false' },
                        ]}
                    />
                </div>
            </div>
        </FormModal>
    );
};

export default {Entidad}Form;
```

---

## 10. `src/pages/{entidades}/components/{Entidad}Detail.tsx`

```typescript
import React from 'react';
import { Hash, Fingerprint, ShieldCheck } from 'lucide-react';
import { {Entidad} } from '../../../types';
import FormModal from '../../../components/ui/FormModal';
import Button from '../../../components/ui/Button';
import InfoHeader from '@/components/ui/InfoHeader';
import InfoGrid, { InfoGridItem } from '@/components/ui/InfoGrid';

interface {Entidad}DetailProps {
    open: boolean;
    onClose: () => void;
    {entidad}: {Entidad} | null;
}

const {Entidad}Detail: React.FC<{Entidad}DetailProps> = ({ open, onClose, {entidad} }) => {
    if (!{entidad}) return null;

    const infoItems: InfoGridItem[] = [
        { label: 'ID del Sistema', value: {entidad}.id || 0, icon: Hash },
        { label: 'UUID Único (Seguridad)', value: {entidad}.uuid, icon: Fingerprint, mono: true },
        // ← agregar más campos informativos según la entidad
    ];

    return (
        <FormModal
            open={open}
            onClose={onClose}
            size="sm"
            icon={<ShieldCheck size={22} />}
            title="Detalle"
            subtitle="Información completa del {entidad}"
            footer={
                <Button variant="ghost" onClick={onClose} className="px-8 font-bold">
                    Cerrar
                </Button>
            }
        >
            <div className="flex flex-col gap-6">
                <InfoHeader
                    isActive={{entidad}.esActivo}
                    title={{entidad}.nombre}
                    subtitle="{Entidad} del sistema"
                    backgroundIcon={<ShieldCheck size={120} />}
                />
                <InfoGrid items={infoItems} />
            </div>
        </FormModal>
    );
};

export default {Entidad}Detail;
```

---

## 11. `src/router/AppRouter.tsx` — Fragmento a agregar

```typescript
// 1. Agregar imports al inicio:
import {Entidades} from '../pages/{entidades}/{Entidades}';
import { {Entidad}Provider } from '../context/{Entidad}Context';

// 2. Dentro del bloque de rutas protegidas:
<Route
    path="{entidades}"
    element={
        <{Entidad}Provider>
            <{Entidades} />
        </{Entidad}Provider>
    }
/>
```