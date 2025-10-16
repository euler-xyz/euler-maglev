import { useState } from 'react';
import { Button } from 'primereact/button';
import { Message } from 'primereact/message';
import { Card } from 'primereact/card';

export function ContractErrorMessage({ error, onRetry, componentName }) {
    const [showDetails, setShowDetails] = useState(false);

    const isContractError = error?.message?.includes('ContractFunctionExecutionError') || 
                           error?.message?.includes('ContractFunctionRevertedError') ||
                           error?.cause?.name === 'ContractFunctionRevertedError';

    const errorTitle = isContractError 
        ? 'Contract Call Failed' 
        : 'Network Error';

    const errorMessage = isContractError
        ? `A contract function call failed. This could be due to network issues, contract state changes, or temporary blockchain congestion.`
        : `Unable to load data. Please check your network connection.`;

    const handleRefresh = () => {
        if (onRetry) {
            onRetry();
        } else {
            window.location.reload();
        }
    };

    console.error(error);

    return (
        <Card className="mt-4">
            <div className="text-center p-4">
                <div className="mb-3">
                    <i className="pi pi-exclamation-triangle" style={{ fontSize: '3rem', color: '#f59e0b' }}></i>
                </div>
                
                <h3 className="mb-3 text-orange-500">{errorTitle}</h3>
                
                <p className="mb-4 text-gray-300">
                    {errorMessage}
                    {componentName && ` (${componentName})`}
                </p>
                
                <div className="flex justify-content-center gap-3 mb-3">
                    <Button 
                        label="Refresh" 
                        icon="pi pi-refresh" 
                        onClick={handleRefresh}
                        className="p-button-warning"
                    />
                    <Button 
                        label={showDetails ? "Hide Details" : "Show Details"} 
                        icon={showDetails ? "pi pi-eye-slash" : "pi pi-eye"}
                        onClick={() => setShowDetails(!showDetails)}
                        className="p-button-secondary"
                    />
                </div>

                {showDetails && (
                    <div className="mt-3 p-3 bg-gray-800 border-round text-left">
                        <h5 className="mb-2">Error Details:</h5>
                        <pre className="text-sm overflow-auto max-h-20rem">
                            {error?.message || String(error)}
                        </pre>
                    </div>
                )}

                <div className="mt-3">
                    <Message 
                        severity="info" 
                        text="If this problem persists, try switching networks or refreshing your browser."
                        className="w-full"
                    />
                </div>
            </div>
        </Card>
    );
}

export function useErrorHandler(componentName) {
    return {
        onError: (error) => {
            console.warn(`Error in ${componentName}:`, error);
            // Don't throw - let the component handle the error state
            return false;
        },
        throwOnError: false, // Disable throwing to prevent black screens
        retry: false, // Disable automatic retries that might spam
    };
}

// Hook to provide consistent error handling options for React Query
export function getErrorHandlingOptions(componentName) {
    return {
        throwOnError: false,
        retry: (failureCount, error) => {
            // Only retry network errors, not contract errors
            const isContractError = error?.message?.includes('ContractFunctionExecutionError') || 
                                   error?.message?.includes('ContractFunctionRevertedError');
            
            if (isContractError) return false;
            
            // Retry network errors up to 2 times with exponential backoff
            return failureCount < 2;
        },
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
        onError: (error) => {
            console.warn(`Query error in ${componentName}:`, error);
        }
    };
}

// Component wrapper that shows error state instead of crashing
export function withErrorHandling(Component, componentName) {
    return function ErrorHandledComponent(props) {
        const [hasError, setHasError] = useState(false);
        const [error, setError] = useState(null);

        const handleRetry = () => {
            setHasError(false);
            setError(null);
            // Force re-render
            window.location.reload();
        };

        if (hasError) {
            return <ContractErrorMessage 
                error={error} 
                onRetry={handleRetry} 
                componentName={componentName} 
            />;
        }

        try {
            return <Component {...props} />;
        } catch (err) {
            setHasError(true);
            setError(err);
            return <ContractErrorMessage 
                error={err} 
                onRetry={handleRetry} 
                componentName={componentName} 
            />;
        }
    };
} 
